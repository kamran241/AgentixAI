import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from db.database import get_db
from db import models, crud
from app.dependencies import get_current_user
from rag.instance import rag_engine

router = APIRouter(prefix="/businesses", tags=["businesses"])


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

    conversation_count = crud.get_session_count_for_business(db, profile.id)

    return {
        "id": profile.id,
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "capabilities": profile.capabilities or {},
        "tables": tables_info,
        "public_token": profile.public_token,
        "conversation_count": conversation_count,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


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

    # Include recent conversations for the detail page
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


@router.post("/ingest", status_code=status.HTTP_201_CREATED)
async def ingest_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    models.Base.metadata.create_all(bind=db.bind)

    os.makedirs("./data/pdfs", exist_ok=True)
    file_path = f"./data/pdfs/{file.filename}"
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

    updated_profile = crud.get_business_by_id(db, business_id)

    return {
        "status": "success",
        "business_id": business_id,
        "business_name": identity.name,
        "public_token": updated_profile.public_token,
        "capabilities": capabilities,
        "tables_created": created_tables,
    }


@router.delete("/{business_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deleted = crud.delete_business_profile(db, business_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Business not found")
