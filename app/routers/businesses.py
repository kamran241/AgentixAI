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
        "conversation_count": crud.get_session_count_for_business(db, profile.id),
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


# ── List & Detail ─────────────────────────────────────────────────────────────

@router.get("/")
def list_businesses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    profiles = crud.get_businesses_by_user(db, current_user.id)
    return [_serialize_business(p, db) for p in profiles]


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


# ── Ingest PDF ────────────────────────────────────────────────────────────────

@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
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

    capabilities = {
        "has_orders": identity.has_orders,
        "has_bookings": identity.has_bookings,
        "has_delivery": identity.has_delivery,
    }

    crud.update_business_profile(
        db,
        profile_id=business_id,
        name=identity.name,
        b_type=identity.type,
        description=identity.description,
        config=[r.model_dump() for r in identity.rules],
        capabilities=capabilities,
        dynamic_tables=created_tables,
    )
    crud.update_pdf_filename(db, business_id, safe_filename)

    updated_profile = crud.get_business_by_id(db, business_id)

    return {
        "status": "success",
        "business_id": business_id,
        "business_name": identity.name,
        "public_token": updated_profile.public_token,
        "capabilities": capabilities,
        "tables_created": created_tables,
    }


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
