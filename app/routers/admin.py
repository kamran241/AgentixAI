from fastapi import APIRouter, Request, Form, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from db.database import get_db
from db import models

router = APIRouter(prefix="/admin", tags=["admin"])

templates = Jinja2Templates(directory="templates")

ADMIN_COOKIE_NAME = "admin_logged_in"
ADMIN_PASSWORD = "123456789"


def get_current_admin(request: Request):
    is_admin = request.cookies.get(ADMIN_COOKIE_NAME)
    if is_admin != "true":
        raise HTTPException(status_code=status.HTTP_302_FOUND, headers={"Location": "/admin/login"})
    return "admin"


@router.get("/login")
async def admin_login_page(request: Request):
    if request.cookies.get(ADMIN_COOKIE_NAME) == "true":
        return RedirectResponse(url="/admin", status_code=status.HTTP_302_FOUND)
    return templates.TemplateResponse("admin_login.html", {"request": request, "error": None})


@router.post("/login")
async def admin_login(request: Request, password: str = Form(...)):
    if password != ADMIN_PASSWORD:
        return templates.TemplateResponse(
            "admin_login.html",
            {"request": request, "error": "Invalid password"},
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    response = RedirectResponse(url="/admin", status_code=status.HTTP_302_FOUND)
    response.set_cookie(ADMIN_COOKIE_NAME, "true", httponly=True)
    return response


@router.get("/logout")
async def admin_logout():
    response = RedirectResponse(url="/admin/login", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(ADMIN_COOKIE_NAME)
    return response


@router.get("/")
async def admin_dashboard(
    request: Request,
    db: Session = Depends(get_db),
    admin: str = Depends(get_current_admin),
):
    """Unified admin dashboard: show counts and recent orders/appointments."""
    orders_count = db.query(models.Order).count()
    appointments_count = db.query(models.Appointment).count()

    recent_orders = (
        db.query(models.Order)
        .order_by(models.Order.created_at.desc())
        .limit(10)
        .all()
    )
    recent_appointments = (
        db.query(models.Appointment)
        .order_by(models.Appointment.appointment_time.desc())
        .limit(10)
        .all()
    )

    # Optional: dynamic table info if present
    profile = db.query(models.BusinessProfile).first()

    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "orders_count": orders_count,
            "appointments_count": appointments_count,
            "recent_orders": recent_orders,
            "recent_appointments": recent_appointments,
            "profile": profile,
        },
    )


@router.get("/orders")
async def admin_orders(
    request: Request,
    db: Session = Depends(get_db),
    admin: str = Depends(get_current_admin),
):
    """Read-only professional order listing view."""
    orders = db.query(models.Order).order_by(models.Order.id.desc()).all()
    return templates.TemplateResponse(
        "admin_orders.html",
        {"request": request, "orders": orders},
    )


@router.get("/appointments")
async def admin_appointments(
    request: Request,
    db: Session = Depends(get_db),
    admin: str = Depends(get_current_admin),
):
    """Read-only clinical bookings/appointments view."""
    appointments = (
        db.query(models.Appointment)
        .order_by(models.Appointment.appointment_time.desc())
        .all()
    )
    return templates.TemplateResponse(
        "admin_appointments.html",
        {"request": request, "appointments": appointments},
    )
