from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from db import models, crud
from app.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notifs = crud.get_notifications(db, current_user.id)
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.type,
            "read": n.read,
            "business_id": n.business_id,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return {"count": crud.get_unread_count(db, current_user.id)}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    crud.mark_notification_read(db, notification_id, current_user.id)
    return {"ok": True}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    crud.mark_all_notifications_read(db, current_user.id)
    return {"ok": True}
