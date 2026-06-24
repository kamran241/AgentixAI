import contextvars
from typing import Optional

from langchain_core.tools import tool
from db.database import SessionLocal
from db import crud, models
from sqlalchemy import text

from rag.instance import rag_engine
from geopy.geocoders import Nominatim
from geopy.exc import GeopyError

# Per-request context variable — set in app/main.py before invoking the graph
current_business_id: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    'current_business_id', default=None
)


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
    """Validate a delivery address using OpenStreetMap. Use before finalizing any delivery order."""
    try:
        geolocator = Nominatim(user_agent="bizbot_validator")
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


# ── Availability Check ────────────────────────────────────────────────────────

@tool
def check_availability(table_name: str, resource_column: str, resource_value: str,
                       time_column: str, requested_time: str):
    """
    Check if a resource (doctor, room, stylist) is available at a given time.
    Queries the specified table to detect conflicts.
    - table_name: the booking/appointment table (from the schema)
    - resource_column: column that identifies the resource (e.g. 'dentist_name', 'room_type')
    - resource_value: the specific resource to check (e.g. 'Dr. Smith', 'Suite')
    - time_column: column that stores the time (e.g. 'appointment_time')
    - requested_time: ISO format datetime string (YYYY-MM-DD HH:MM)
    """
    db = SessionLocal()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(db, table_name, biz_id):
            return {"available": False, "message": f"Table '{table_name}' not found for this business."}

        safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")
        safe_res_col = "".join(c for c in resource_column if c.isalnum() or c == "_")
        safe_time_col = "".join(c for c in time_column if c.isalnum() or c == "_")

        result = db.execute(
            text(f"SELECT 1 FROM {safe_table} WHERE {safe_res_col} = :resource AND {safe_time_col} = :t_time"),
            {"resource": resource_value, "t_time": requested_time}
        ).fetchone()

        if result:
            return {
                "available": False,
                "message": f"'{resource_value}' is already booked at {requested_time}. Please suggest a different time."
            }
        return {"available": True, "message": f"'{resource_value}' is available at {requested_time}."}
    finally:
        db.close()


# ── Generic Record Save ───────────────────────────────────────────────────────

@tool
def save_record(table_name: str, record_data: dict, session_id: str):
    """
    Save or update a record in any business table.
    Use this to store orders, bookings, customer info, or any business data.
    - table_name: exact table name from the schema (e.g. 'pizza_orders_1')
    - record_data: dict of column_name -> value pairs matching the table schema
    - session_id: current session ID to link the record to this conversation
    """
    db = SessionLocal()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(db, table_name, biz_id):
            return {"status": "error", "message": f"Table '{table_name}' not found for this business."}

        crud.generic_save(db, table_name, session_id, record_data)
        crud.create_audit_log(
            db, "record_saved",
            {"table": table_name, "data_keys": list(record_data.keys())},
            session_id, business_id=biz_id
        )
        return {"status": "success", "message": f"Record saved to '{table_name}'."}
    finally:
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
    db = SessionLocal()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(db, table_name, biz_id):
            return {"status": "error", "message": f"Table '{table_name}' not found for this business."}

        rows = crud.generic_query(db, table_name, filters=filters, limit=limit)
        return {"status": "success", "rows": rows, "count": len(rows)}
    finally:
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
    db = SessionLocal()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(db, table_name, biz_id):
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
        db.close()


# ── Customer History ──────────────────────────────────────────────────────────

@tool
def get_customer_history(phone_number: str):
    """
    Find all records for a returning customer across all business tables using their phone number.
    Call this whenever a customer provides their phone number.
    """
    db = SessionLocal()
    biz_id = current_business_id.get()
    try:
        tables = _get_business_tables(db, biz_id)
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
        db.close()
