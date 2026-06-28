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

# ── Booking record validation ─────────────────────────────────────────────────

_NAME_KEYS  = {'customer_name', 'name', 'full_name', 'patient_name', 'client_name',
               'guest_name', 'contact_name', 'user_name'}
_PHONE_KEYS = {'customer_phone', 'phone', 'phone_number', 'mobile', 'contact',
               'mobile_number', 'telephone', 'cell'}
_EMAIL_KEYS = {'customer_email', 'email', 'email_address', 'contact_email', 'mail'}

# Values the AI is known to hallucinate instead of real customer data
_FAKE_VALUES = {
    '', 'n/a', 'na', 'none', 'null', 'unknown', 'test', 'placeholder',
    'john doe', 'jane doe', 'your name', 'customer name', 'customer',
    '1234567890', '0000000000', '123456789', '000', 'xxxxxxxxxx',
    'session123', 'test@example.com', 'example@example.com',
}


def _check_required_fields(record_data: dict, always_insert: bool) -> str | None:
    """Return an error string if a booking record is missing real name/phone/email."""
    if not always_insert:
        return None  # order upserts are more flexible

    data = {k.lower().strip(): str(v).lower().strip() for k, v in record_data.items() if v is not None}

    name  = next((data[k] for k in _NAME_KEYS  if k in data and data[k]), None)
    phone = next((data[k] for k in _PHONE_KEYS if k in data and data[k]), None)
    email = next((data[k] for k in _EMAIL_KEYS if k in data and data[k]), None)

    missing = []
    if not name or name in _FAKE_VALUES or len(name) < 2:
        missing.append("customer's full name")
    if not phone or phone in _FAKE_VALUES or not any(ch.isdigit() for ch in phone):
        missing.append("phone number")
    if not email or email in _FAKE_VALUES or '@' not in email:
        missing.append("email address")

    if missing:
        return (
            f"BLOCKED: cannot save — missing {' and '.join(missing)}. "
            "Ask the customer for this information before calling save_record again."
        )
    return None


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
            {"sources": sources, "result_count": len(docs)},
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
    from db.crud import compute_slots_for_date, get_business_session

    biz_id = current_business_id.get()
    platform_db = SessionLocal()
    try:
        profile = platform_db.query(models.BusinessProfile).filter(
            models.BusinessProfile.id == biz_id
        ).first()
        if not profile:
            return {"available_slots": [], "message": "Business not found."}

        if not (profile.availability or {}).get("schedule"):
            return {
                "available_slots": [],
                "message": "The business owner hasn't configured their schedule yet. Ask them to set it up in the admin panel.",
            }

        date = date.strip()
        try:
            from datetime import datetime
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            return {"available_slots": [], "message": "Invalid date — use YYYY-MM-DD format."}

        data_db = get_business_session(profile)
        try:
            info = compute_slots_for_date(profile, date, data_db)
        finally:
            data_db.close()

        if not info:
            return {"available_slots": [], "message": "No schedule information available for that date."}

        if not info.get("open"):
            schedule = (profile.availability or {}).get("schedule", {})
            open_days = [d.capitalize() for d, v in schedule.items() if v.get("open")]
            reason = info.get("reason", "")
            if reason == "holiday/blocked":
                msg = f"{date} is a holiday or blocked date. Please suggest another day."
            else:
                msg = f"We are closed on {info['day']}s. Open days: {', '.join(open_days)}. Please suggest a different day."
            return {"available_slots": [], "open": False, "message": msg}

        free = info["free_slots"]
        return {
            "date": date,
            "day": info["day"],
            "open_hours": info.get("open_hours", ""),
            "available_slots": free,
            "booked_slots": info.get("booked_slots", []),
            "message": (
                f"{len(free)} slot(s) free on {date} ({info['day']}). First available: {free[0]}."
                if free else f"No slots available on {date}. All slots are booked."
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
    # Validate required fields before touching the database
    validation_error = _check_required_fields(record_data, always_insert)
    if validation_error:
        return {"status": "error", "message": validation_error}

    platform_db = SessionLocal()
    db = _get_data_session()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(platform_db, table_name, biz_id):
            return {"status": "error", "message": f"Table '{table_name}' not found for this business."}

        ok, msg = crud.generic_save(db, table_name, session_id, record_data, always_insert=always_insert)
        if not ok:
            return {"status": "error", "message": msg}

        crud.create_audit_log(
            platform_db, "record_saved",
            {"table": table_name, "data_keys": list(record_data.keys())},
            session_id, business_id=biz_id
        )

        # Fire notification to business owner for new bookings
        if always_insert:
            try:
                profile = crud.get_business_by_id(platform_db, biz_id)
                if profile and profile.user_id:
                    customer = record_data.get("customer_name") or record_data.get("name") or "A customer"
                    time_val = next(
                        (str(v) for k, v in record_data.items()
                         if any(w in k.lower() for w in ("time", "date", "appointment", "slot")) and v),
                        None
                    )
                    notif_msg = f"{customer} made a booking at {profile.name}"
                    if time_val:
                        notif_msg += f" — {time_val}"
                    crud.create_notification(
                        platform_db,
                        user_id=profile.user_id,
                        business_id=biz_id,
                        title="New Booking",
                        message=notif_msg,
                        type="booking",
                    )
            except Exception:
                pass  # never block the booking save due to notification failure

        return {"status": "success", "message": f"Record saved to '{table_name}'."}
    finally:
        platform_db.close()
        db.close()


# ── Cancel Booking ────────────────────────────────────────────────────────────

@tool
def cancel_booking(table_name: str, booking_id: int):
    """
    Cancel (delete) an existing booking row to free its time slot.
    Use this for rescheduling: call get_records first to find the booking id,
    then cancel_booking to free the old slot, then save_record for the new time.
    - table_name: exact table name from the schema
    - booking_id: the 'id' value of the row to cancel (obtained from get_records)
    """
    platform_db = SessionLocal()
    db = _get_data_session()
    biz_id = current_business_id.get()
    try:
        if not _validate_table(platform_db, table_name, biz_id):
            return {"status": "error", "message": f"Table '{table_name}' not found for this business."}

        safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")
        result = db.execute(
            text(f"DELETE FROM {safe_table} WHERE id = :bid"),
            {"bid": booking_id},
        )

        # Check rowcount before commit — DBAPI spec only guarantees it's valid
        # on the cursor before the transaction is closed.
        if result.rowcount == 0:
            db.rollback()
            return {"status": "error", "message": f"No booking found with id={booking_id}."}

        db.commit()

        crud.create_audit_log(
            platform_db, "booking_cancelled",
            {"table": table_name, "booking_id": booking_id},
            "system", business_id=biz_id,
        )
        return {
            "status": "success",
            "message": f"Booking #{booking_id} cancelled and slot freed. Now proceed to book the new time with save_record.",
        }
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
