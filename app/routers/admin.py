import os
from fastapi import APIRouter, Request, Form, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from db.database import get_db
from db import models, crud

router = APIRouter(prefix="/admin", tags=["admin"])
templates = Jinja2Templates(directory="templates")

ADMIN_COOKIE_NAME = "admin_logged_in"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme")


def get_current_admin(request: Request):
    if request.cookies.get(ADMIN_COOKIE_NAME) != "true":
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
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.name != ""
    ).order_by(models.BusinessProfile.id.desc()).first()

    # Build per-table stats and recent rows for the active business
    tables_data = []
    if profile and profile.dynamic_tables:
        for table_info in profile.dynamic_tables:
            table_name = table_info['table_name']
            row_count = crud.get_table_row_count(db, table_name)
            recent_rows = []
            columns = []
            try:
                recent_rows = crud.generic_query(db, table_name, limit=5)
                columns = list(recent_rows[0].keys()) if recent_rows else [
                    c['name'] for c in table_info.get('columns', [])
                ]
            except Exception:
                pass
            tables_data.append({
                "name": table_name,
                "purpose": table_info.get("purpose", ""),
                "row_count": row_count,
                "columns": columns,
                "recent_rows": recent_rows,
            })

    total_records = sum(t["row_count"] for t in tables_data)

    return templates.TemplateResponse(
        "admin_dashboard.html",
        {
            "request": request,
            "profile": profile,
            "tables_data": tables_data,
            "total_records": total_records,
        },
    )


@router.get("/tables/{table_name}")
async def admin_table_view(
    request: Request,
    table_name: str,
    db: Session = Depends(get_db),
    admin: str = Depends(get_current_admin),
):
    """Full view of all rows in a specific dynamic table."""
    profile = db.query(models.BusinessProfile).filter(
        models.BusinessProfile.name != ""
    ).order_by(models.BusinessProfile.id.desc()).first()

    # Validate table belongs to this business
    table_info = None
    if profile and profile.dynamic_tables:
        table_info = next(
            (t for t in profile.dynamic_tables if t['table_name'] == table_name), None
        )

    if not table_info:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found.")

    rows = []
    columns = []
    try:
        rows = crud.generic_query(db, table_name, limit=200)
        columns = list(rows[0].keys()) if rows else [c['name'] for c in table_info.get('columns', [])]
    except Exception as e:
        rows = []

    return templates.TemplateResponse(
        "admin_table.html",
        {
            "request": request,
            "profile": profile,
            "table_info": table_info,
            "columns": columns,
            "rows": rows,
        },
    )
