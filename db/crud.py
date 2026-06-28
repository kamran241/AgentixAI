import json
import secrets

from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import text

from . import models, database
from core.security import hash_password, verify_password, encrypt_db_url, decrypt_db_url


# ── External DB engine cache ──────────────────────────────────────────────────

_external_engines: dict = {}


def get_business_engine(profile: models.BusinessProfile):
    """Return the SQLAlchemy engine for a business — external if configured, platform otherwise."""
    if not profile or not profile.external_db_url:
        return database.engine
    biz_id = profile.id
    if biz_id not in _external_engines:
        url = decrypt_db_url(profile.external_db_url)
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        _external_engines[biz_id] = create_engine(url, pool_pre_ping=True, pool_size=3, max_overflow=5)
    return _external_engines[biz_id]


def get_business_session(profile: models.BusinessProfile) -> Session:
    """Return a new Session bound to the business's engine (external or platform)."""
    engine = get_business_engine(profile)
    return sessionmaker(bind=engine)()


def set_external_db_url(db: Session, business_id: int, user_id: int, raw_url: str | None):
    """Encrypt and store (or clear) the external DB URL for a business."""
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == business_id,
        models.BusinessProfile.user_id == user_id,
    ).first()
    if not profile:
        return None
    if raw_url:
        profile.external_db_url = encrypt_db_url(raw_url)
        # Evict cached engine so next call rebuilds with new URL
        _external_engines.pop(business_id, None)
    else:
        profile.external_db_url = None
        _external_engines.pop(business_id, None)
    db.commit()
    db.refresh(profile)
    return profile


# ── Users ─────────────────────────────────────────────────────────────────────

def create_user(db: Session, email: str, password: str, name: str) -> models.User:
    user = models.User(
        email=email,
        hashed_password=hash_password(password),
        name=name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_id(db: Session, user_id: int) -> models.User | None:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.query(models.User).filter(models.User.email == email).first()


def authenticate_user(db: Session, email: str, password: str) -> models.User | None:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


# ── Audit Log ─────────────────────────────────────────────────────────────────

def create_audit_log(db: Session, action: str, details: dict,
                     session_id: str = None, business_id: int = None):
    log = models.AuditLog(action=action, details=details,
                          session_id=session_id, business_id=business_id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# ── Sessions ──────────────────────────────────────────────────────────────────

def get_session(db: Session, session_id: str):
    return db.query(models.Session).filter(models.Session.id == session_id).first()


def create_session(db: Session, session_id: str, business_id: int = None):
    db_session = models.Session(id=session_id, business_id=business_id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def update_session_history(db: Session, session_id: str, history: list):
    db_session = get_session(db, session_id)
    if db_session:
        db_session.history = history
        db.commit()


def get_session_count_for_business(db: Session, business_id: int) -> int:
    return db.query(models.Session).filter(
        models.Session.business_id == business_id
    ).count()


# ── Business Profile ──────────────────────────────────────────────────────────

def create_business_profile(db: Session, user_id: int = None) -> models.BusinessProfile:
    """Reserve a business_id before ingestion starts."""
    profile = models.BusinessProfile(
        user_id=user_id,
        public_token=secrets.token_urlsafe(24),
        name="", business_type="", description="",
        config=[], capabilities={}, dynamic_tables=[]
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def update_business_profile(db: Session, profile_id: int, name: str, b_type: str,
                              description: str, config: list, capabilities: dict,
                              dynamic_tables: list) -> models.BusinessProfile:
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == profile_id
    ).first()
    if profile:
        profile.name = name
        profile.business_type = b_type
        profile.description = description
        profile.config = config
        profile.capabilities = capabilities
        profile.dynamic_tables = dynamic_tables
        db.commit()
        db.refresh(profile)
    return profile


def get_businesses_by_user(db: Session, user_id: int) -> list[models.BusinessProfile]:
    return db.query(models.BusinessProfile).filter(
        models.BusinessProfile.user_id == user_id,
        models.BusinessProfile.name != ""
    ).order_by(models.BusinessProfile.id.desc()).all()


def get_business_by_token(db: Session, token: str) -> models.BusinessProfile | None:
    return db.query(models.BusinessProfile).filter(
        models.BusinessProfile.public_token == token
    ).first()


def get_business_by_id(db: Session, business_id: int) -> models.BusinessProfile | None:
    return db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == business_id
    ).first()


def update_widget_config(db: Session, business_id: int, user_id: int, config: dict) -> models.BusinessProfile | None:
    from sqlalchemy.orm.attributes import flag_modified
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == business_id,
        models.BusinessProfile.user_id == user_id,
    ).first()
    if not profile:
        return None
    profile.widget_config = dict(config)
    flag_modified(profile, "widget_config")
    db.commit()
    db.refresh(profile)
    return profile


def update_availability(db: Session, business_id: int, user_id: int, data: dict):
    from sqlalchemy.orm.attributes import flag_modified
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == business_id,
        models.BusinessProfile.user_id == user_id,
    ).first()
    if not profile:
        return None
    profile.availability = data
    flag_modified(profile, "availability")
    db.commit()
    db.refresh(profile)
    return profile


def compute_slots_for_date(profile, date_str: str, data_db=None) -> dict | None:
    """Return free/booked slots for one date based on the business availability config."""
    from datetime import datetime, timedelta

    availability = profile.availability or {}
    if isinstance(availability, str):
        import json as _json
        try:
            availability = _json.loads(availability)
        except Exception:
            return None
    if not availability or not availability.get("schedule"):
        return None

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return None

    day_name = dt.strftime("%A").lower()
    day_cfg  = availability["schedule"].get(day_name, {})

    if not day_cfg.get("open", False):
        return {"date": date_str, "day": day_name.capitalize(), "open": False, "free_slots": []}

    if date_str in (availability.get("blocked_dates") or []):
        return {"date": date_str, "day": day_name.capitalize(), "open": False,
                "free_slots": [], "reason": "holiday/blocked"}

    slot_min = int(availability.get("slot_duration", 30))
    buffer   = int(availability.get("buffer_minutes", 0))
    start_dt = datetime.strptime(f"{date_str} {day_cfg.get('start','09:00')}", "%Y-%m-%d %H:%M")
    end_dt   = datetime.strptime(f"{date_str} {day_cfg.get('end','17:00')}", "%Y-%m-%d %H:%M")

    all_slots: list[str] = []
    cur = start_dt
    while cur + timedelta(minutes=slot_min) <= end_dt:
        all_slots.append(cur.strftime("%H:%M"))
        cur += timedelta(minutes=slot_min + buffer)

    booked: set[str] = set()
    if data_db:
        for t in (profile.dynamic_tables or []):
            time_cols = [c["name"] for c in t.get("columns", [])
                         if any(k in c["name"].lower() for k in ["time","date","appointment","booking","slot"])]
            for col in time_cols:
                safe_t = "".join(c for c in t["table_name"] if c.isalnum() or c == "_")
                safe_c = "".join(c for c in col if c.isalnum() or c == "_")
                try:
                    rows = data_db.execute(
                        text(f"SELECT CAST({safe_c} AS TEXT) FROM {safe_t} WHERE CAST({safe_c} AS TEXT) LIKE :p"),
                        {"p": f"{date_str}%"}
                    ).fetchall()
                    for r in rows:
                        if r[0]:
                            booked.add(r[0][11:16] if len(r[0]) > 10 else r[0][:5])
                except Exception:
                    pass

    free = [s for s in all_slots if s not in booked]
    return {
        "date": date_str,
        "day": day_name.capitalize(),
        "open": True,
        "open_hours": f"{day_cfg.get('start')} – {day_cfg.get('end')}",
        "free_slots": free,
        "booked_slots": sorted(booked),
    }


def get_table_records(db: Session, table_name: str, limit: int = 200) -> list:
    """Fetch all records from a dynamic table for admin display."""
    safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")
    try:
        res = db.execute(text(f"SELECT * FROM {safe_table} ORDER BY created_at DESC LIMIT {limit}"))
        return [dict(r._mapping) for r in res]
    except Exception:
        return []


def update_pdf_filename(db: Session, business_id: int, filename: str):
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == business_id
    ).first()
    if profile:
        profile.pdf_filename = filename
        db.commit()


def delete_business_profile(db: Session, business_id: int, user_id: int) -> bool:
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.id == business_id,
        models.BusinessProfile.user_id == user_id
    ).first()
    if not profile:
        return False
    for t in (profile.dynamic_tables or []):
        drop_dynamic_table(db, t['table_name'])
    db.delete(profile)
    db.commit()
    return True


# ── Dynamic Tables (DDL) ──────────────────────────────────────────────────────

def create_dynamic_table(db: Session, table_name: str, columns: list, business_id: int,
                          external_engine=None) -> str:
    """Create a business-specific SQL table, optionally on an external engine."""
    safe_name = "".join(c for c in table_name if c.isalnum() or c == "_")
    full_table_name = f"{safe_name}_{business_id}"

    target_engine = external_engine or db.bind
    is_pg = target_engine.dialect.name == "postgresql"
    id_col = "id SERIAL PRIMARY KEY" if is_pg else "id INTEGER PRIMARY KEY AUTOINCREMENT"
    ts_type = "TIMESTAMP" if is_pg else "DATETIME"

    _ALLOWED_TYPES = {
        "TEXT", "INTEGER", "INT", "BIGINT", "SMALLINT", "REAL", "FLOAT",
        "NUMERIC", "DECIMAL", "BOOLEAN", "BOOL", "DATE", "DATETIME",
        "TIMESTAMP", "VARCHAR", "DOUBLE PRECISION",
    }

    col_defs = [id_col, "session_id TEXT"]
    for col in columns:
        col_name = "".join(c for c in col['name'] if c.isalnum() or c == "_")
        ctype = col['type'].upper().strip()
        if ctype not in _ALLOWED_TYPES:
            ctype = "TEXT"
        if is_pg:
            if ctype == "DATETIME": ctype = "TIMESTAMP"
            if ctype == "REAL": ctype = "DOUBLE PRECISION"
        # Booking/time columns get a UNIQUE constraint so the DB atomically prevents
        # double-booking even under concurrent inserts (no TOCTOU race possible).
        is_time_col = any(kw in col['name'].lower() for kw in _TIME_COLUMN_KEYWORDS)
        col_defs.append(f"{col_name} {ctype}{' UNIQUE' if is_time_col else ''}")

    col_defs.append(f"created_at {ts_type} DEFAULT CURRENT_TIMESTAMP")
    sql = f"CREATE TABLE IF NOT EXISTS {full_table_name} ({', '.join(col_defs)})"

    if external_engine:
        with external_engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()
    else:
        db.execute(text(sql))
        db.commit()
    return full_table_name


def drop_dynamic_table(db: Session, table_name: str):
    try:
        safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")
        db.execute(text(f"DROP TABLE IF EXISTS {safe_table}"))
        db.commit()
    except Exception as e:
        print(f"Error dropping table {table_name}: {e}")


# ── Generic Table Operations ──────────────────────────────────────────────────

_TIME_COLUMN_KEYWORDS = {"time", "date", "appointment", "booking", "slot", "schedule", "datetime"}


def generic_save(db: Session, table_name: str, session_id: str, data: dict,
                 always_insert: bool = False) -> tuple[bool, str]:
    """
    Insert or update a row in a dynamic table.
    - always_insert=True  → always INSERT (bookings); also enforces no duplicate time slot.
    - always_insert=False → UPSERT by session_id (orders).
    Returns (True, "") on success or (False, error_message) on conflict/error.
    """
    safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")

    is_pg = db.bind.dialect.name == "postgresql"
    if is_pg:
        res = db.execute(text(
            f"SELECT column_name FROM information_schema.columns WHERE table_name = '{safe_table}'"
        ))
        existing_cols = [r[0] for r in res]
    else:
        res = db.execute(text(f"PRAGMA table_info({safe_table})"))
        existing_cols = [r[1] for r in res]

    safe_data = {"session_id": session_id}
    for k, v in data.items():
        clean_key = k.lower().replace(" ", "_")
        if clean_key in existing_cols and clean_key != "session_id":
            safe_data[clean_key] = json.dumps(v) if isinstance(v, (list, dict)) else v

    # Atomic slot-conflict check for booking inserts
    if always_insert:
        time_col = next(
            (k for k in safe_data
             if k not in ("session_id", "created_at", "id")
             and any(kw in k.lower() for kw in _TIME_COLUMN_KEYWORDS)
             and safe_data[k]),
            None,
        )
        if time_col:
            slot_val = str(safe_data[time_col]).strip()
            conflict = db.execute(
                text(f"SELECT 1 FROM {safe_table} WHERE CAST({time_col} AS TEXT) = :sv LIMIT 1"),
                {"sv": slot_val},
            ).fetchone()
            if conflict:
                return False, (
                    f"Slot conflict: '{slot_val}' is already booked. "
                    "Call get_available_slots to find a free time and offer alternatives."
                )

    if not always_insert:
        exists = db.execute(
            text(f"SELECT 1 FROM {safe_table} WHERE session_id = :sid"),
            {"sid": session_id}
        ).fetchone()
    else:
        exists = None

    try:
        if exists:
            set_clause = ", ".join(f"{k} = :{k}" for k in safe_data if k != "session_id")
            if set_clause:
                db.execute(text(f"UPDATE {safe_table} SET {set_clause} WHERE session_id = :session_id"), safe_data)
        else:
            keys = ", ".join(safe_data.keys())
            placeholders = ", ".join(f":{k}" for k in safe_data.keys())
            db.execute(text(f"INSERT INTO {safe_table} ({keys}) VALUES ({placeholders})"), safe_data)
        db.commit()
        return True, ""
    except IntegrityError:
        db.rollback()
        # UNIQUE constraint on the time column fired — concurrent request already claimed this slot.
        return False, (
            "Slot conflict: that time slot was just booked by another request. "
            "Call get_available_slots to find a free time and offer alternatives."
        )


def generic_query(db: Session, table_name: str, filters: dict = None, limit: int = 50) -> list:
    safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")

    if filters:
        safe_filters = {
            k.lower().replace(" ", "_"): v
            for k, v in filters.items()
            if k.isidentifier()
        }
        where_clause = " AND ".join(f"{k} = :{k}" for k in safe_filters)
        sql = f"SELECT * FROM {safe_table} WHERE {where_clause} ORDER BY created_at DESC LIMIT {limit}"
        res = db.execute(text(sql), safe_filters)
    else:
        res = db.execute(text(f"SELECT * FROM {safe_table} ORDER BY created_at DESC LIMIT {limit}"))

    return [dict(r._mapping) for r in res]


def get_table_row_count(db: Session, table_name: str) -> int:
    safe_table = "".join(c for c in table_name if c.isalnum() or c == "_")
    try:
        return db.execute(text(f"SELECT COUNT(*) FROM {safe_table}")).scalar() or 0
    except Exception:
        return 0


# ── Notifications ─────────────────────────────────────────────────────────────

def create_notification(db: Session, user_id: int, business_id: int, title: str, message: str, type: str = "booking") -> models.Notification:
    notif = models.Notification(user_id=user_id, business_id=business_id, title=title, message=message, type=type)
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def get_notifications(db: Session, user_id: int, limit: int = 30) -> list:
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id)
        .order_by(models.Notification.created_at.desc())
        .limit(limit)
        .all()
    )


def get_unread_count(db: Session, user_id: int) -> int:
    return db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.read == False
    ).count()


def mark_notification_read(db: Session, notification_id: int, user_id: int):
    db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == user_id
    ).update({"read": True})
    db.commit()


def mark_all_notifications_read(db: Session, user_id: int):
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.read == False
    ).update({"read": True})
    db.commit()
