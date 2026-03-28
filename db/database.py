import os
print("DEBUG: database.py is loading...")
print("DEBUG: Importing SQLAlchemy components...")
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
print("DEBUG: SQLAlchemy components imported.")
from dotenv import load_dotenv

print("DEBUG: Env Loading...")
load_dotenv(override=True)
print("DEBUG: Env Loaded.")

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
USE_SQLITE = os.getenv("USE_SQLITE", "false").lower() == "true"

if not SQLALCHEMY_DATABASE_URL or USE_SQLITE:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./sqlite.db"
    if USE_SQLITE:
        print("💡 USE_SQLITE is True. Forcing local SQLite: sqlite.db")
    else:
        print("⚠️ No DATABASE_URL found. Falling back to local SQLite: sqlite.db")

print(f"DEBUG: DATABASE_URL is {SQLALCHEMY_DATABASE_URL}")

# Handle differences between SQLite and PostgreSQL
connect_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}

print("DEBUG: Creating Engine...")
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args=connect_args
)
print("DEBUG: Engine Created.")

print("DEBUG: Creating SessionLocal...")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
print("DEBUG: SessionLocal Created.")

print("DEBUG: Creating Base...")
Base = declarative_base()
print("DEBUG: Base Created.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
