import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

_SQLITE_URL = "sqlite:///./sqlite.db"

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Neon (and some other Postgres hosts) send postgres:// — SQLAlchemy needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def _make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={"connect_timeout": 5},
    )

def _test_engine(eng):
    with eng.connect() as conn:
        conn.execute(text("SELECT 1"))

# Try configured DB first; fall back to SQLite on any connection error
if DATABASE_URL and not DATABASE_URL.startswith("sqlite"):
    try:
        engine = _make_engine(DATABASE_URL)
        _test_engine(engine)
        logger.info("Connected to PostgreSQL database.")
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed ({e}). Falling back to SQLite.")
        DATABASE_URL = _SQLITE_URL
        engine = _make_engine(_SQLITE_URL)
else:
    DATABASE_URL = _SQLITE_URL
    engine = _make_engine(_SQLITE_URL)

_is_sqlite = DATABASE_URL.startswith("sqlite")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
