import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db import models, crud
from app.dependencies import get_current_user
from rag.instance import rag_engine

router = APIRouter(prefix="/businesses", tags=["businesses"])


def _parse_json_field(value):
    """Return value as a dict, parsing it if it arrived as a raw JSON string."""
    if not value:
        return {}
    if isinstance(value, str):
        import json as _j
        try:
            return _j.loads(value)
        except Exception:
            return {}
    return value

UPLOAD_DIR = "./data/pdfs"
LOGO_DIR = "./data/logos"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(LOGO_DIR, exist_ok=True)

DEFAULT_WIDGET_CONFIG = {
    "bot_name": "AI Assistant",
    "primary_color": "#6366f1",
    "bg_color": "#0b0f1a",
    "welcome_message": "Hi! How can I help you today?",
    "position": "right",
    "logo_url": None,
}


def _serialize_business(profile: models.BusinessProfile, db: Session) -> dict:
    tables_info = []
    for t in (profile.dynamic_tables or []):
        row_count = crud.get_table_row_count(db, t["table_name"])
        tables_info.append({
            "name": t["table_name"],
            "purpose": t.get("purpose", ""),
            "columns": t.get("columns", []),
            "row_count": row_count,
        })

    widget_cfg = {**DEFAULT_WIDGET_CONFIG, **(profile.widget_config or {})}

    return {
        "id": profile.id,
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "capabilities": profile.capabilities or {},
        "tables": tables_info,
        "public_token": profile.public_token,
        "widget_config": widget_cfg,
        "pdf_filename": profile.pdf_filename,
        "has_pdf": bool(profile.pdf_filename),
        "custom_prompt": profile.custom_prompt or "",
        "external_db_connected": bool(profile.external_db_url),
        "availability": _parse_json_field(profile.availability),
        "conversation_count": crud.get_session_count_for_business(db, profile.id),
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


# ── List, all-bookings (must come before /{business_id} to avoid route clash) ──

@router.get("/")
def list_businesses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profiles = crud.get_businesses_by_user(db, current_user.id)
    return [_serialize_business(p, db) for p in profiles]


@router.get("/all-bookings")
def get_all_bookings(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return recent records (bookings + orders) across all user businesses."""
    profiles = crud.get_businesses_by_user(db, current_user.id)
    results = []

    def _ser(v):
        if hasattr(v, 'isoformat'):
            return v.isoformat()
        return v

    for profile in profiles:
        caps = profile.capabilities or {}
        # include any business that saves records (bookings OR orders OR custom)
        if not any(caps.get(k) for k in ("has_bookings", "has_orders", "has_custom")):
            continue
        data_db = crud.get_business_session(profile)
        try:
            for t in (profile.dynamic_tables or []):
                # always include booking tables; include order tables too
                cols = [c["name"].lower() for c in t.get("columns", [])]
                is_booking = any(k in c for k in ["time","date","appointment","booking","slot"] for c in cols)
                is_order   = any(k in c for k in ["order","item","qty","quantity","product","price","total"] for c in cols)
                if not (is_booking or is_order):
                    continue
                rows = crud.get_table_records(data_db, t["table_name"], limit=limit)
                for row in rows:
                    results.append({
                        "business_id": profile.id,
                        "business_name": profile.name,
                        "table": t["table_name"],
                        "record_type": "booking" if is_booking else "order",
                        **{k: _ser(v) for k, v in row.items()},
                    })
        finally:
            data_db.close()

    results.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return results[:limit]


@router.get("/{business_id}")
def get_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")

    data = _serialize_business(profile, db)

    sessions = (
        db.query(models.Session)
        .filter(models.Session.business_id == business_id)
        .order_by(models.Session.created_at.desc())
        .limit(20)
        .all()
    )
    data["recent_sessions"] = [
        {
            "id": s.id,
            "message_count": len([m for m in (s.history or []) if m.get("type") == "human"]),
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]
    return data


# ── Step 1: Analyze PDF (returns suggested schema, creates NO tables yet) ──────

@router.post("/analyze", status_code=status.HTTP_201_CREATED)
async def analyze_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload PDF, run AI analysis, return suggested schema for user review."""
    models.Base.metadata.create_all(bind=db.bind)

    safe_filename = os.path.basename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    profile = crud.create_business_profile(db, user_id=current_user.id)
    business_id = profile.id

    identity = rag_engine.ingest_business_file(file_path, business_id)

    capabilities = {
        "has_orders": identity.has_orders,
        "has_bookings": identity.has_bookings,
        "has_delivery": identity.has_delivery,
    }

    # Save everything except dynamic tables — user will confirm those next
    crud.update_business_profile(
        db,
        profile_id=business_id,
        name=identity.name,
        b_type=identity.type,
        description=identity.description,
        config=[r.model_dump() for r in identity.rules],
        capabilities=capabilities,
        dynamic_tables=[],   # empty until confirmed
    )
    crud.update_pdf_filename(db, business_id, safe_filename)

    return {
        "business_id": business_id,
        "name": identity.name,
        "type": identity.type,
        "description": identity.description,
        "capabilities": capabilities,
        "suggested_tables": [
            {
                "table_name": t.table_name,
                "purpose": t.purpose,
                "columns": [c.model_dump() for c in t.columns],
            }
            for t in identity.suggested_tables
        ],
    }


# ── Step 2: Confirm schema (user-edited tables actually created here) ──────────

class ColumnDef(BaseModel):
    name: str
    type: str = "TEXT"

class TableDef(BaseModel):
    table_name: str
    purpose: str = ""
    columns: list[ColumnDef] = []

class ConfirmSchemaRequest(BaseModel):
    tables: list[TableDef]


@router.post("/{business_id}/confirm-schema", status_code=status.HTTP_201_CREATED)
def confirm_schema(
    business_id: int,
    body: ConfirmSchemaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create dynamic tables from the user-confirmed (possibly edited) schema."""
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")

    external_engine = crud.get_business_engine(profile) if profile.external_db_url else None

    created_tables = []
    for t in body.tables:
        if not t.table_name.strip():
            continue
        actual_name = crud.create_dynamic_table(
            db,
            table_name=t.table_name.strip(),
            columns=[{"name": c.name, "type": c.type} for c in t.columns],
            business_id=business_id,
            external_engine=external_engine,
        )
        created_tables.append({
            "table_name": actual_name,
            "purpose": t.purpose,
            "columns": [{"name": c.name, "type": c.type} for c in t.columns],
        })

    # Patch dynamic_tables onto the profile
    from sqlalchemy.orm.attributes import flag_modified
    profile.dynamic_tables = created_tables
    flag_modified(profile, "dynamic_tables")
    db.commit()

    updated = crud.get_business_by_id(db, business_id)
    return {
        "status": "success",
        "business_id": business_id,
        "business_name": updated.name,
        "public_token": updated.public_token,
        "tables_created": created_tables,
    }


# ── Legacy ingest (auto-confirms schema — no user review) ─────────────────────

@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """One-shot ingest: AI chooses schema automatically. Kept for compatibility."""
    models.Base.metadata.create_all(bind=db.bind)

    safe_filename = os.path.basename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    profile = crud.create_business_profile(db, user_id=current_user.id)
    business_id = profile.id
    identity = rag_engine.ingest_business_file(file_path, business_id)

    created_tables = []
    for table_schema in identity.suggested_tables:
        actual_name = crud.create_dynamic_table(
            db,
            table_name=table_schema.table_name,
            columns=[c.model_dump() for c in table_schema.columns],
            business_id=business_id,
        )
        created_tables.append({
            "table_name": actual_name,
            "purpose": table_schema.purpose,
            "columns": [c.model_dump() for c in table_schema.columns],
        })

    capabilities = {"has_orders": identity.has_orders, "has_bookings": identity.has_bookings, "has_delivery": identity.has_delivery}
    crud.update_business_profile(db, profile_id=business_id, name=identity.name, b_type=identity.type,
        description=identity.description, config=[r.model_dump() for r in identity.rules],
        capabilities=capabilities, dynamic_tables=created_tables)
    crud.update_pdf_filename(db, business_id, safe_filename)
    updated_profile = crud.get_business_by_id(db, business_id)

    return {"status": "success", "business_id": business_id, "business_name": identity.name,
            "public_token": updated_profile.public_token, "capabilities": capabilities, "tables_created": created_tables}


# ── View PDF ──────────────────────────────────────────────────────────────────

@router.get("/{business_id}/pdf")
def view_pdf(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")
    if not profile.pdf_filename:
        raise HTTPException(status_code=404, detail="No PDF uploaded for this business")

    file_path = os.path.join(UPLOAD_DIR, profile.pdf_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server")

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=profile.pdf_filename,
        headers={"Content-Disposition": f'inline; filename="{profile.pdf_filename}"'},
    )


# ── Widget Config ─────────────────────────────────────────────────────────────

class WidgetConfigRequest(BaseModel):
    bot_name: str = "AI Assistant"
    primary_color: str = "#6366f1"
    bg_color: str = "#0b0f1a"
    welcome_message: str = "Hi! How can I help you today?"
    position: str = "right"


@router.put("/{business_id}/widget-config")
def update_widget_config(
    business_id: int,
    body: WidgetConfigRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Read existing config first so we never drop logo_url or other fields
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")
    merged = {**(profile.widget_config or {}), **body.model_dump()}
    updated = crud.update_widget_config(db, business_id, current_user.id, merged)
    return {**DEFAULT_WIDGET_CONFIG, **(updated.widget_config or {})}


# ── Logo Upload ───────────────────────────────────────────────────────────────

@router.post("/{business_id}/logo")
async def upload_logo(
    business_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        raise HTTPException(status_code=400, detail="Only PNG, JPG, WEBP, SVG allowed")

    logo_filename = f"logo_{business_id}{ext}"
    logo_path = os.path.join(LOGO_DIR, logo_filename)
    with open(logo_path, "wb") as f:
        f.write(await file.read())

    logo_url = f"/uploads/logos/{logo_filename}"
    existing = dict(profile.widget_config or {})
    existing["logo_url"] = logo_url
    crud.update_widget_config(db, business_id, current_user.id, existing)

    return {"logo_url": logo_url}


# ── External Database ─────────────────────────────────────────────────────────

class ExternalDbRequest(BaseModel):
    url: str = ""   # empty string = disconnect


@router.put("/{business_id}/external-db")
def set_external_db(
    business_id: int,
    body: ExternalDbRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    raw_url = body.url.strip()

    # Test connection before saving
    if raw_url:
        try:
            from sqlalchemy import create_engine, text as sa_text
            test_url = raw_url
            if test_url.startswith("postgres://"):
                test_url = test_url.replace("postgres://", "postgresql://", 1)
            test_engine = create_engine(test_url, connect_args={"connect_timeout": 8})
            with test_engine.connect() as conn:
                conn.execute(sa_text("SELECT 1"))
            test_engine.dispose()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")

    profile = crud.set_external_db_url(db, business_id, current_user.id, raw_url or None)
    if not profile:
        raise HTTPException(status_code=404, detail="Business not found")

    return {"connected": bool(profile.external_db_url)}


@router.post("/{business_id}/test-external-db")
def test_external_db(
    business_id: int,
    body: ExternalDbRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Test a connection string without saving it."""
    raw_url = body.url.strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="No URL provided")
    try:
        from sqlalchemy import create_engine, text as sa_text
        if raw_url.startswith("postgres://"):
            raw_url = raw_url.replace("postgres://", "postgresql://", 1)
        engine = create_engine(raw_url, connect_args={"connect_timeout": 8})
        with engine.connect() as conn:
            conn.execute(sa_text("SELECT 1"))
        engine.dispose()
        return {"ok": True, "message": "Connection successful"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


# ── Migrate existing tables to external DB ───────────────────────────────────

@router.post("/{business_id}/migrate-tables")
def migrate_tables_to_external_db(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create all dynamic tables in the external DB (run after connecting an external DB)."""
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")
    if not profile.external_db_url:
        raise HTTPException(status_code=400, detail="No external database connected")

    from sqlalchemy import text as sa_text
    external_engine = crud.get_business_engine(profile)
    created, skipped = [], []
    for t in (profile.dynamic_tables or []):
        table_name = t["table_name"]
        safe_name = "".join(c for c in table_name if c.isalnum() or c == "_")
        try:
            is_pg = external_engine.dialect.name == "postgresql"
            id_col = "id SERIAL PRIMARY KEY" if is_pg else "id INTEGER PRIMARY KEY AUTOINCREMENT"
            ts_type = "TIMESTAMP" if is_pg else "DATETIME"
            col_defs = [id_col, "session_id TEXT"]
            for col in t.get("columns", []):
                col_name = "".join(c for c in col["name"] if c.isalnum() or c == "_")
                ctype = col["type"].upper()
                if is_pg:
                    if ctype == "DATETIME": ctype = "TIMESTAMP"
                    if ctype == "REAL": ctype = "DOUBLE PRECISION"
                col_defs.append(f"{col_name} {ctype}")
            col_defs.append(f"created_at {ts_type} DEFAULT CURRENT_TIMESTAMP")
            sql = f"CREATE TABLE IF NOT EXISTS {safe_name} ({', '.join(col_defs)})"
            with external_engine.connect() as conn:
                conn.execute(sa_text(sql))
                conn.commit()
            created.append(table_name)
        except Exception as e:
            skipped.append({"table": table_name, "error": str(e)})

    return {"created": created, "skipped": skipped,
            "message": f"Migrated {len(created)} table(s) to external database."}


# ── Custom Prompt ─────────────────────────────────────────────────────────────

class CustomPromptRequest(BaseModel):
    custom_prompt: str = ""


@router.put("/{business_id}/custom-prompt")
def update_custom_prompt(
    business_id: int,
    body: CustomPromptRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")
    profile.custom_prompt = body.custom_prompt.strip() or None
    db.commit()
    db.refresh(profile)
    return {"custom_prompt": profile.custom_prompt or ""}


# ── Availability ──────────────────────────────────────────────────────────────

DEFAULT_SCHEDULE = {
    day: {"open": day not in ("saturday", "sunday"), "start": "09:00", "end": "17:00"}
    for day in ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]
}

class AvailabilityRequest(BaseModel):
    schedule: dict = {}
    slot_duration: int = 30
    buffer_minutes: int = 0
    blocked_dates: list = []


@router.put("/{business_id}/availability")
def set_availability(
    business_id: int,
    body: AvailabilityRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = crud.update_availability(
        db, business_id, current_user.id,
        body.model_dump()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Business not found")
    return profile.availability


@router.get("/{business_id}/slots")
def get_slots(
    business_id: int,
    date: str,   # YYYY-MM-DD query param
    db: Session = Depends(get_db),
):
    """Public — returns free time slots for a given date. Used by widget & admin."""
    from datetime import datetime, timedelta
    from sqlalchemy import text

    profile = crud.get_business_by_id(db, business_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Business not found")

    availability = profile.availability or {}
    if not availability or not availability.get("schedule"):
        return {"slots": [], "booked": [], "message": "No schedule configured"}

    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    day_name = dt.strftime("%A").lower()
    day_cfg = availability["schedule"].get(day_name, {})

    if not day_cfg.get("open", False):
        return {"slots": [], "booked": [], "open": False,
                "message": f"Closed on {day_name.capitalize()}s"}

    if date in (availability.get("blocked_dates") or []):
        return {"slots": [], "booked": [], "open": False,
                "message": f"{date} is a blocked / holiday date"}

    slot_min = int(availability.get("slot_duration", 30))
    buffer   = int(availability.get("buffer_minutes", 0))
    start_dt = datetime.strptime(f"{date} {day_cfg.get('start','09:00')}", "%Y-%m-%d %H:%M")
    end_dt   = datetime.strptime(f"{date} {day_cfg.get('end','17:00')}", "%Y-%m-%d %H:%M")

    all_slots = []
    cur = start_dt
    while cur + timedelta(minutes=slot_min) <= end_dt:
        all_slots.append(cur.strftime("%H:%M"))
        cur += timedelta(minutes=slot_min + buffer)

    # Find already-booked slots from dynamic tables
    booked = set()
    data_db = crud.get_business_session(profile)
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
        "slot_duration": slot_min,
        "slots": free,
        "booked": list(booked),
    }


@router.get("/{business_id}/records/{table_name}")
def get_table_records(
    business_id: int,
    table_name: str,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profile = crud.get_business_by_id(db, business_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Business not found")
    if not any(t["table_name"] == table_name for t in (profile.dynamic_tables or [])):
        raise HTTPException(status_code=404, detail="Table not found")

    data_db = crud.get_business_session(profile)
    try:
        records = crud.get_table_records(data_db, table_name, limit)
    finally:
        data_db.close()

    # Serialize datetime objects
    def _ser(v):
        if hasattr(v, 'isoformat'):
            return v.isoformat()
        return v
    return [{ k: _ser(v) for k, v in row.items() } for row in records]


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deleted = crud.delete_business_profile(db, business_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Business not found")
