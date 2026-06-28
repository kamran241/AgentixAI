from dotenv import load_dotenv
load_dotenv(override=True)

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from db import models, database
from app.routers import admin as admin_router
from app.routers.auth import router as auth_router
from app.routers.businesses import router as businesses_router
from app.routers.chat import router as chat_router
from app.routers.widget import router as widget_router
from app.routers.notifications import router as notifications_router

app = FastAPI(
    title="Agentix API",
    description="AI-powered booking and reservation system",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)

os.makedirs("./data/logos", exist_ok=True)
os.makedirs("./data/pdfs", exist_ok=True)
app.mount("/uploads/logos", StaticFiles(directory="./data/logos"), name="logos")


def _seed_default_user():
    """Create the default admin user on first startup if it doesn't exist."""
    db = database.SessionLocal()
    try:
        from db.crud import get_user_by_email, create_user
        if not get_user_by_email(db, "admin@admin.com"):
            create_user(db, email="admin@admin.com", password="admin@123", name="Admin")
            print("✓ Default user created — admin@admin.com / admin@123")
    finally:
        db.close()


_seed_default_user()

app.include_router(auth_router)
app.include_router(businesses_router)
app.include_router(chat_router)
app.include_router(widget_router)
app.include_router(admin_router.router)
app.include_router(notifications_router)


# Legacy endpoint — kept for backwards compatibility with existing frontend
@app.post("/ingest-pdf")
async def ingest_pdf_legacy():
    from fastapi import HTTPException
    raise HTTPException(
        status_code=410,
        detail="This endpoint has moved. Use POST /businesses/ingest with authentication.",
    )


@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
