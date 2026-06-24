import contextvars
from typing import Optional

from langchain_core.tools import tool
from db.database import SessionLocal
from db import crud, models
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from rag.instance import rag_engine
from geopy.geocoders import Nominatim
from geopy.exc import GeopyError

# Per-request context variables — set in routers before invoking the graph
current_business_id: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    'current_business_id', default=None
)


def _get_data_session():
    """Return a session for dynamic table operations — external DB if configured."""
    biz_id = current_business_id.get()
    if biz_id:
        platform_db = SessionLocal()
        try:
            profile = platform_db.query(models.BusinessProfile).filter(
                models.BusinessProfile.id == biz_id
            ).first()
            if profile and profile.external_db_url:
                engine = crud.get_business_engine(profile)
                return sessionmaker(bind=engine)()
        finally:
            platform_db.close()
    return SessionLocal()


def _get_business_tables(db, business_id: int) -> list:
    """Return the list of dynamic_tables metadata for a business."""
    if not business_id:
        return []
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == business_id
    ).first()
    return profile.dynamic_tables or [] if profile else []


def _validate_table(db, table_name: str, business_id: int) -> bool:
    """Make sure the table_name belongs to the current business."""
    tables = _get_business_tables(db, business_id)
    return any(t['table_name'] == table_name for t in tables)


# ── Knowledge ────────────────────────────────────────────────────────────────

@tool
def search_knowledge(query: str):
    """Search the business PDF knowledge base for menu, pricing, services, hours, or policies."""
    db = SessionLocal()
    biz_id = current_business_id.get()
    try:
        context, docs = rag_engine.query_knowledge(query, biz_id)
        sources = [doc.metadata.get("page", 0) for doc in docs]
        crud.create_audit_log(
            db, "knowledge_retrieved",
            {"query": query, "sources": sources, "snippet": context[:200]},
            "system", business_id=biz_id
        )
        return {"context": context, "sources": sources}
    finally:
        db.close()


# ── Address Validation ────────────────────────────────────────────────────────

@tool
def validate_address(address: str):
    """
    Validate any address worldwide using OpenStreetMap (Nominatim).
    Works for addresses in any country and language.
    Use before finalising delivery orders, confirming meeting locations, or verifying customer addresses.
    """
    try:
        geolocator = Nominatim(user_agent="agentix_platform/1.0", timeout=5)
        location = geolocator.geocode(address, addressdetails=True, language="en")
        if location:
            a = location.raw.get('address', {})
            return {
                "valid": True,
                "full_address": location.address,
                "house_number": a.get('house_number'),
                "road": a.get('road'),
                "suburb": a.get('suburb'),
                "city": a.get('city') or a.get('town') or a.get('village') or a.get('county'),
                "state": a.get('state') or a.get('province') or a.get('region'),
                "postal_code": a.get('postcode'),
                "country": a.get('country'),
                "country_code": a.get('country_code', '').upper(),
                "latitude": location.latitude,
                "longitude": location.longitude,
            }
        return {"valid": False, "message": "Address not found. Please ask the customer to provide more details (street, city, country)."}
    except GeopyError:
        return {"valid": False, "message": "Address validation temporarily unavailable. Proceed with the address as provided."}


# ── Get Available Slots ───────────────────────────────────────────────────────

@tool
def get_available_slots(date: str, resource: str = ""):
    """
    Get genuinely free appointment slots for a specific date based on the business schedule.
    ALWAYS call this before suggesting or confirming any booking time.
    - date: YYYY-MM-DD format (e.g. '2025-06-24')
    - resource: optional — specific staff member or room to check
    Returns free slots, already-booked slots, and open hours for that day.
    """
    from datetime import datetime, timedelta

    biz_id = current_business_id.get()
    platform_db = SessionLocal()
    try:
        profile = platform_db.query(models.BusinessProfile).filter(
            models.BusinessProfile.id == biz_id
        ).first()
        if not profile:
            return {"available_slots": [], "message": "Business not found."}

        availability = profile.availability or {}
        if isinstance(availability, str):
            import json as _json
            try:
                availability = _json.loads(availability)
            except Exception:
                availability = {}
        if not availability or not availability.get("schedule"):
            return {
                "available_slots": [],
                "message": "The business owner hasn't configured their schedule yet. Ask them to set it up in the admin panel."
            }

        try:
            dt = datetime.strptime(date.strip(), "%Y-%m-%d")
        except ValueError:
            return {"available_slots": [], "message": "Invalid date — use YYYY-MM-DD format."}

        day_name = dt.strftime("%A").lower()
        schedule = availability.get("schedule", {})
        day_cfg = schedule.get(day_name, {})

        if not day_cfg.get("open", False):
            open_days = [d.capitalize() for d, v in schedule.items() if v.get("open")]
            return {
                "available_slots": [],
                "open": False,
                "message": f"We are closed on {day_name.capitalize()}s. Open days: {', '.join(open_days)}. Please suggest a different day.",
            }

        if date in (availability.get("blocked_dates") or []):
            return {"available_slots": [], "open": False,
                    "message": f"{date} is a holiday or blocked date. Please suggest another day."}

        slot_min = int(availability.get("slot_duration", 30))
        buffer   = int(availability.get("buffer_minutes", 0))
        start_dt = datetime.strptime(f"{date} {day_cfg.get('start','09:00')}", "%Y-%m-%d %H:%M")
        end_dt   = datetime.strptime(f"{date} {day_cfg.get('end','17:00')}", "%Y-%m-%d %H:%M")

        all_slots = []
        cur = start_dt
        while cur + timedelta(minutes=slot_min) <= end_dt:
            all_slots.append(cur.strftime("%H:%M"))
            cur += timedelta(minutes=slot_min + buffer)

        # Check booked slots
        data_db = _get_data_session()
        booked = set()
        try:
            for t in (profile.dynamic_tables or []):
                time_cols = [c["name"] for c in t.get("columns", [])
                             if any(k in c["name"].lower() for k in ["time","date","appointment","booking","slot"])]
                for col in time_cols:
                    safe_t = "".join(c for c in t["table_name"] if c.isalnum() or c == "_")
                    safe_c = "".join(c for c in col if c.isalnum() or c == "_")
                    try:
                        rows = data_db.execute(
                            text(f"SELECT CAST({safe_c} AS TEXT) FROM {safe_t} WHERE CAST({safe_c} AS TEXT) LIKE :p"),
                            {"p": f"{date}%"}
                        ).fetchall()
                        for r in rows:
                            if r[0]:
                                booked.add(r[0][11:16] if len(r[0]) > 10 else r[0][:5])
                    except Exception:
                        pass
        finally:
            data_db.close()

        free = [s for s in all_slots if s not in booked]
        return {
            "date": date,
            "day": day_name.capitalize(),
            "open_hours": f"{day_cfg.get('start')} – {day_cfg.get('end')}",
            "slot_duration_minutes": slot_min,
            "available_slots": free,
            "booked_slots": sorted(booked),
            "message": (
                f"{len(free)} slot(s) free on {date} ({day_name.capitalize()}). "
                f"First available: {free[0]}." if free
                else f"No slots available on {date}. All {len(all_slots)} slots are booked."
            ),
        }
    finally:
        platform_db.close()


# ── Availability Check ────────────────────────────────────────────────────────

@tool
def check_availability(table_name: str, time_column: str, requested_time: str,
                       resource_column: str = "", resource_value: str = ""):
    """
    Check if a time slot is available (no conflicting booking exists).
    Queries the booking table and returns taken slots for context.
    - table_name: the booking/appointment table (e.g. 'appointments_1')
    - time_column: column that stores the time (e.g. 'appointment_time', 'booking_date')
    - requested_time: the time to check, any readable format (e.g. '2025-01-15 10:00', 'Jan 15 10am')
    - resource_column: optional — column for a specific resource (e.g. 'doctor', 'room')
    - resource_value: optional — the specific resource to check (e.g. 'Dr. Smith')
    """
    platform_db = SessionLocal()
    biz_id = current_business_id.get()
    db = _get_data_session()
    try:
        if not _validate_table(platform_db, table_name, biz_id):
            return {"available": False, "message": f"Table '{table_name}' not found for this business."}

        safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")
        safe_time_col = "".join(c for c in time_column if c.isalnum() or c == "_")

        # Use LIKE match on the time prefix — handles "10:00" matching "10:00:00"
        time_prefix = requested_time.strip().rstrip(":00").rstrip(":0")
        params: dict = {"t_prefix": f"{requested_time}%"}
        base_where = f"CAST({safe_time_col} AS TEXT) LIKE :t_prefix"

        if resource_column and resource_value:
            safe_res_col = "".join(c for c in resource_column if c.isalnum() or c == "_")
            where = f"{base_where} AND {safe_res_col} = :resource"
            params["resource"] = resource_value
        else:
            where = base_where

        conflict = db.execute(
            text(f"SELECT {safe_time_col} FROM {safe_table} WHERE {where} LIMIT 5"),
            params
        ).fetchall()

        # Also fetch the next 5 upcoming slots so the agent can suggest alternatives
        taken_slots_today = db.execute(
            text(f"SELECT CAST({safe_time_col} AS TEXT) FROM {safe_table} "
                 f"WHERE CAST({safe_time_col} AS TEXT) >= :day ORDER BY {safe_time_col} LIMIT 10"),
            {"day": requested_time[:10]}
        ).fetchall()
        taken = [r[0] for r in taken_slots_today]

        if conflict:
            return {
                "available": False,
                "message": f"That slot is already booked. Other taken slots on this day: {taken}. Please suggest a free time.",
                "taken_slots": taken,
            }
        return {
            "available": True,
            "message": f"Slot is free at {requested_time}.",
            "taken_slots": taken,
        }
    finally:
        platform_db.close()
        db.close()


# ── Generic Record Save ───────────────────────────────────────────────────────

@tool
def save_record(table_name: str, record_data: dict, session_id: str, always_insert: bool = False):
    """
    Save a record in any business table.
    - table_name: exact table name from the schema (e.g. 'appointments_1', 'pizza_orders_1')
    - record_data: dict of column_name -> value pairs matching the table schema
    - session_id: current session ID to link the record to this conversation
    - always_insert: set True for bookings/appointments so each booking is a NEW row.
      Set False (default) for orders where you want to update the session's existing row.
    """
    platform_db = SessionLocal()
    db = _get_data_session()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(platform_db, table_name, biz_id):
            return {"status": "error", "message": f"Table '{table_name}' not found for this business."}

        crud.generic_save(db, table_name, session_id, record_data, always_insert=always_insert)
        crud.create_audit_log(
            platform_db, "record_saved",
            {"table": table_name, "data_keys": list(record_data.keys())},
            session_id, business_id=biz_id
        )
        return {"status": "success", "message": f"Record saved to '{table_name}'."}
    finally:
        platform_db.close()
        db.close()


# ── Generic Record Read ───────────────────────────────────────────────────────

@tool
def get_records(table_name: str, filters: dict = None, limit: int = 10):
    """
    Read records from any business table.
    Use to check order status, look up a booking, or retrieve history.
    - table_name: exact table name from the schema
    - filters: optional dict of {column: value} to filter results (e.g. {'session_id': '...'})
    - limit: max number of rows to return (default 10)
    """
    platform_db = SessionLocal()
    db = _get_data_session()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(platform_db, table_name, biz_id):
            return {"status": "error", "message": f"Table '{table_name}' not found for this business."}

        rows = crud.generic_query(db, table_name, filters=filters, limit=limit)
        return {"status": "success", "rows": rows, "count": len(rows)}
    finally:
        platform_db.close()
        db.close()


# ── Stats / Upsell ────────────────────────────────────────────────────────────

@tool
def analyze_stats(table_name: str, group_column: str):
    """
    Count occurrences of each value in a column to find the most popular items or services.
    Use at the start of an order interaction to suggest top sellers.
    - table_name: exact table name from the schema
    - group_column: column to count by (e.g. 'item_name', 'service_type')
    """
    platform_db = SessionLocal()
    db = _get_data_session()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(platform_db, table_name, biz_id):
            return {"popular": [], "message": f"Table '{table_name}' not found."}

        safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")
        safe_col = "".join(c for c in group_column if c.isalnum() or c == "_")

        res = db.execute(text(
            f"SELECT {safe_col}, COUNT(*) as cnt FROM {safe_table} "
            f"WHERE {safe_col} IS NOT NULL GROUP BY {safe_col} ORDER BY cnt DESC LIMIT 5"
        ))
        rows = res.fetchall()
        popular = [r[0] for r in rows]
        return {
            "popular": popular,
            "message": f"Most popular: {', '.join(popular)}." if popular else "No data yet."
        }
    finally:
        platform_db.close()
        db.close()


# ── Customer History ──────────────────────────────────────────────────────────

@tool
def get_customer_history(phone_number: str):
    """
    Find all records for a returning customer across all business tables using their phone number.
    Call this whenever a customer provides their phone number.
    """
    platform_db = SessionLocal()
    db = _get_data_session()
    biz_id = current_business_id.get()
    try:
        tables = _get_business_tables(platform_db, biz_id)
        all_records = {}

        for table_info in tables:
            table_name = table_info['table_name']
            columns = [c['name'] for c in table_info.get('columns', [])]
            phone_cols = [c for c in columns if 'phone' in c.lower()]

            for phone_col in phone_cols:
                try:
                    rows = crud.generic_query(db, table_name, filters={phone_col: phone_number})
                    if rows:
                        all_records[table_name] = rows
                except Exception:
                    pass

        found = bool(all_records)
        total = sum(len(v) for v in all_records.values())
        return {
            "found": found,
            "summary": f"Found {total} record(s) across {len(all_records)} table(s)." if found else "No history found for this customer.",
            "history": all_records
        }
    finally:
        platform_db.close()
        db.close()
