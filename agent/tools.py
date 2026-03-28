from langchain_core.tools import tool
from rag.engine import RAGEngine
from db.database import SessionLocal
from db import crud, models
import json
from datetime import datetime

from rag.instance import rag_engine
from geopy.geocoders import Nominatim
from geopy.exc import GeopyError

@tool
def validate_address(address: str):
    """
    Check if a physical address exists and is valid using OpenStreetMap (FREE). 
    Use this to verify delivery addresses or business locations.
    It validates postal codes and city/street matches (e.g. '78 front street Toronto M4K 6B2').
    """
    try:
        # User-agent is required by Nominatim
        geolocator = Nominatim(user_agent="bizbot_validator")
        # Global validation (removed country_codes restriction)
        location = geolocator.geocode(address, addressdetails=True)
        if location:
            details = location.raw.get('address', {})
            return {
                "valid": True,
                "full_address": location.address,
                "city": details.get('city') or details.get('town') or details.get('village'),
                "postal_code": details.get('postcode'),
                "country": details.get('country')
            }
        return {"valid": False, "message": "Address not found or invalid."}
    except GeopyError:
        return {"valid": False, "message": "Validation service temporarily unavailable."}

@tool
def search_knowledge(query: str):
    """Search the business PDF for information about menu, pricing, services, hours, or policies."""
    db = SessionLocal()
    try:
        context, docs = rag_engine.query_knowledge(query)
        sources = [doc.metadata.get("page", 0) for doc in docs]
        
        # Log the retrieval for audit transparency
        crud.create_audit_log(db, "knowledge_retrieved", {"query": query, "sources": sources, "context_snippet": context[:200]}, "system")
        
        return {"context": context, "sources": sources}
    finally:
        db.close()

@tool
def update_cart(items: list[dict], session_id: str):
    """Update the user's current order/cart. 'items' should be a list of dicts with 'name', 'quantity', 'options'."""
    # In a real app, this might update a temporary state in DB
    # For now, we return it to the agent to manage in state
    return {"status": "updated", "current_cart": items}

@tool
def check_availability(resource_name: str, requested_time: str):
    """Check if a resource (doctor, table, cosmetician) is available at a given time. time format: YYYY-MM-DD HH:MM."""
    db = SessionLocal()
    try:
        requested_dt = datetime.fromisoformat(requested_time)
        # Check for exact collision or overlapping status
        conflict = db.query(models.Appointment).filter(
            models.Appointment.service_name == resource_name,
            models.Appointment.status == "booked",
            models.Appointment.appointment_time == requested_dt
        ).first()

        if conflict:
            return {
                "available": False, 
                "message": f"'{resource_name}' is already booked at {requested_time}. Please suggest a different time."
            }
        
        return {"available": True, "message": f"'{resource_name}' is available at {requested_time}"}
    finally:
        db.close()

@tool
def finalize_order(session_id: str, cart: list, total_price: float, customer_info: dict):
    """Finalize and save a product or service order to the database. If an order already exists for this session, it will be updated."""
    db = SessionLocal()
    try:
        session_id = str(session_id)
        if not crud.get_session(db, session_id):
            crud.create_session(db, session_id)
            
        # 1. UPSERT Logic - Check for existing order in this session
        order = db.query(models.Order).filter(models.Order.session_id == session_id).first()
        if order:
            order = crud.update_order(db, order.id, total_price, {"items": cart, "customer": customer_info})
            action = "order_updated"
        else:
            order = crud.create_order(db, session_id, total_price, {"items": cart, "customer": customer_info})
            action = "order_confirmed"
        
        # 2. Dynamic Table Injection (Specific)
        profile = db.query(models.BusinessProfile).first()
        if profile and profile.dynamic_table_name:
            details = {**customer_info, "total_price": total_price}
            for item in cart:
                details.update(item)
            
            try:
                # Check if session exists in dynamic table to update it
                from sqlalchemy import text
                table = profile.dynamic_table_name
                # Simple check for existing session_id in dynamic table
                exists = db.execute(text(f"SELECT 1 FROM {table} WHERE session_id = :sid"), {"sid": session_id}).fetchone()
                
                if exists:
                    # Generic Update for Dynamic Table
                    cols = details.keys()
                    set_clause = ", ".join([f"{c} = :{c}" for c in cols if c != "session_id"])
                    sql = f"UPDATE {table} SET {set_clause} WHERE session_id = :session_id"
                    db.execute(text(sql), {**details, "session_id": session_id})
                    db.commit()
                else:
                    crud.insert_dynamic_data(db, table, session_id, details)
            except Exception as e:
                print(f"Dynamic table operation failed: {e}")
            
        crud.create_audit_log(db, action, {"order_id": order.id, "total": total_price, "table": profile.dynamic_table_name if profile else "none"}, session_id)
        return {"status": "success", "order_id": order.id, "message": f"Order {order.id} {action.split('_')[1]} and saved to specialized table!"}
    finally:
        db.close()

@tool
def create_booking(session_id: str, resource_name: str, time_str: str, customer_name: str, customer_phone: str, additional_details: dict = None):
    """Create a time-based booking/appointment. 'additional_details' is a dict for business-specific fields (e.g. laundry weight, reason for visit)."""
    db = SessionLocal()
    try:
        session_id = str(session_id)
        if not crud.get_session(db, session_id):
            crud.create_session(db, session_id)

        book_time = datetime.fromisoformat(time_str)
        
        # 1. CHECK CONFLICTS FIRST (Safety)
        conflict = db.query(models.Appointment).filter(
            models.Appointment.service_name == resource_name,
            models.Appointment.status == "booked",
            models.Appointment.appointment_time == book_time
        ).first()
        
        if conflict:
            return {
                "status": "error",
                "message": f"CRITICAL: '{resource_name}' was just booked by someone else at {time_str}. Please ask the user for another time."
            }

        # 2. Save to Master Appointment Table
        apt = crud.create_appointment(db, session_id, resource_name, book_time, customer_name, customer_phone)
        
        # 2. Dynamic Table Injection (The Flexible Part)
        profile = db.query(models.BusinessProfile).first()
        if profile and profile.dynamic_table_name:
            details = {
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "service_name": resource_name,
                "appointment_time": time_str
            }
            if additional_details:
                details.update(additional_details)
            
            try:
                crud.insert_dynamic_data(db, profile.dynamic_table_name, session_id, details)
            except Exception as e:
                print(f"Dynamic booking insert failed: {e}")

        crud.create_audit_log(db, "booking_created", {"id": apt.id, "resource": resource_name, "time": time_str, "table": profile.dynamic_table_name if profile else "none"}, session_id)
        return {"status": "success", "booking_id": apt.id, "message": f"Booking for {resource_name} confirmed at {time_str}. Details saved to your custom '{profile.dynamic_table_name if profile else 'master'}' table."}
    finally:
        db.close()

@tool
def modify_booking(session_id: str, booking_id: int, new_time_str: str):
    """Reschedule or change the time of an existing booking or reservation."""
    db = SessionLocal()
    try:
        new_time = datetime.fromisoformat(new_time_str)
        apt = db.query(models.Appointment).filter(models.Appointment.id == booking_id).first()
        if apt:
            apt.appointment_time = new_time
            db.commit()
            crud.create_audit_log(db, "booking_modified", {"id": booking_id, "new_time": new_time_str}, session_id)
            return {"status": "success", "message": f"Booking {booking_id} moved to {new_time_str}"}
        return {"status": "error", "message": "Booking not found"}
    finally:
        db.close()

@tool
def cancel_booking(session_id: str, booking_id: int):
    """Cancel any existing booking, reservation, or appointment."""
    db = SessionLocal()
    try:
        apt = crud.update_appointment_status(db, booking_id, "cancelled")
        if apt:
            crud.create_audit_log(db, "booking_cancelled", {"id": booking_id}, session_id)
            return {"status": "success", "message": f"Booking {booking_id} has been cancelled."}
        return {"status": "error", "message": "Booking not found"}
    finally:
        db.close()

@tool
def update_order(session_id: str, order_id: int, cart: list, total_price: float, customer_info: dict):
    """Modify an existing order that was already finalized."""
    db = SessionLocal()
    try:
        updated = crud.update_order(db, order_id, total_price, {"items": cart, "customer": customer_info})
        if updated:
            # Also update dynamic table if exists
            profile = db.query(models.BusinessProfile).first()
            if profile and profile.dynamic_table_name:
                details = {**customer_info, "total_price": total_price}
                for item in cart: details.update(item)
                try: crud.insert_dynamic_data(db, profile.dynamic_table_name, session_id, details)
                except: pass
            
            crud.create_audit_log(db, "order_updated", {"order_id": order_id}, session_id)
            return {"status": "success", "message": f"Order {order_id} has been updated."}
        return {"status": "error", "message": "Order not found."}
    finally:
        db.close()

@tool
def cancel_order(session_id: str, order_id: int):
    """Completely remove an existing order from the database."""
    db = SessionLocal()
    try:
        success = crud.delete_order(db, order_id)
        if success:
            crud.create_audit_log(db, "order_deleted", {"order_id": order_id}, session_id)
            return {"status": "success", "message": f"Order {order_id} has been deleted."}
        return {"status": "error", "message": "Order not found."}
    finally:
        db.close()

@tool
def analyze_business_stats():
    """
    Requirement 75: Analyze historical orders to find 'popular' items or common combinations.
    Use this to suggest the best-selling food/services to a user.
    """
    db = SessionLocal()
    try:
        # Simple frequency analysis of ordered items
        orders = db.query(models.Order).all()
        item_counts = {}
        
        for order in orders:
            details = order.order_details or {}
            items = details.get('items', [])
            for item in items:
                name = item.get('name', 'Unknown')
                item_counts[name] = item_counts.get(name, 0) + 1
        
        # Sort by popularity
        sorted_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)
        popular_items = [name for name, count in sorted_items[:3]]
        
        return {
            "popular_items": popular_items,
            "message": f"Based on order history, the most popular items are: {', '.join(popular_items)}."
        }
    finally:
        db.close()

@tool
def get_order_status(order_id: int):
    """Check the status of an existing order."""
    db = SessionLocal()
    try:
        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if order:
            return {"status": order.status, "details": order.order_details}
        return {"status": "not_found"}
    finally:
        db.close()

@tool
def get_customer_history(phone_number: str):
    """
    Requirement 20/48: Retrieve past orders and appointments for a customer using their phone number.
    Use this to 'recognize' a returning customer and provide personalized service or recommendations.
    """
    db = SessionLocal()
    try:
        # Search across all sessions for this phone number
        sessions = db.query(models.Session).filter(models.Session.customer_phone == phone_number).all()
        session_ids = [s.id for s in sessions]
        
        orders = db.query(models.Order).filter(models.Order.session_id.in_(session_ids)).all()
        appointments = db.query(models.Appointment).filter(models.Appointment.customer_phone == phone_number).all()
        
        history = {
            "order_count": len(orders),
            "appointment_count": len(appointments),
            "past_orders": [{"id": o.id, "total": o.total_price, "details": o.order_details} for o in orders],
            "past_appointments": [{"id": a.id, "service": a.service_name, "time": a.appointment_time.isoformat()} for a in appointments]
        }
        
        return {
            "found": len(orders) > 0 or len(appointments) > 0,
            "summary": f"Customer has {len(orders)} past orders and {len(appointments)} appointments.",
            "history": history
        }
    finally:
        db.close()
