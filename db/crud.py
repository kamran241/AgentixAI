import json
import secrets

from sqlalchemy.orm import Session
from sqlalchemy import text

from . import models
from core.security import hash_password, verify_password


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

def create_dynamic_table(db: Session, table_name: str, columns: list, business_id: int) -> str:
    """Create a business-specific SQL table namespaced with business_id."""
    safe_name = "".join(c for c in table_name if c.isalnum() or c == "_")
    full_table_name = f"{safe_name}_{business_id}"

    is_pg = db.bind.dialect.name == "postgresql"
    id_col = "id SERIAL PRIMARY KEY" if is_pg else "id INTEGER PRIMARY KEY AUTOINCREMENT"
    ts_type = "TIMESTAMP" if is_pg else "DATETIME"

    col_defs = [id_col, "session_id TEXT"]
    for col in columns:
        col_name = "".join(c for c in col['name'] if c.isalnum() or c == "_")
        ctype = col['type'].upper()
        if is_pg:
            if ctype == "DATETIME": ctype = "TIMESTAMP"
            if ctype == "REAL": ctype = "DOUBLE PRECISION"
        col_defs.append(f"{col_name} {ctype}")

    col_defs.append(f"created_at {ts_type} DEFAULT CURRENT_TIMESTAMP")
    sql = f"CREATE TABLE IF NOT EXISTS {full_table_name} ({', '.join(col_defs)})"
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

def generic_save(db: Session, table_name: str, session_id: str, data: dict) -> bool:
    """Insert or update a row in a dynamic table, keyed by session_id."""
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

    exists = db.execute(
        text(f"SELECT 1 FROM {safe_table} WHERE session_id = :sid"),
        {"sid": session_id}
    ).fetchone()

    if exists:
        set_clause = ", ".join(f"{k} = :{k}" for k in safe_data if k != "session_id")
        if set_clause:
            db.execute(text(f"UPDATE {safe_table} SET {set_clause} WHERE session_id = :session_id"), safe_data)
    else:
        keys = ", ".join(safe_data.keys())
        placeholders = ", ".join(f":{k}" for k in safe_data.keys())
        db.execute(text(f"INSERT INTO {safe_table} ({keys}) VALUES ({placeholders})"), safe_data)

    db.commit()
    return True


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
