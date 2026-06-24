"""
One-time migration: adds user_id and public_token columns to business_profiles.
Run once with: python migrate.py
"""
import secrets
from sqlalchemy import text
from db.database import engine, SessionLocal

def migrate():
    with engine.connect() as conn:
        # Check existing columns
        result = conn.execute(text("PRAGMA table_info(business_profiles)"))
        existing = {row[1] for row in result}

        if "user_id" not in existing:
            conn.execute(text("ALTER TABLE business_profiles ADD COLUMN user_id INTEGER"))
            print("✓ Added user_id column")

        if "public_token" not in existing:
            conn.execute(text("ALTER TABLE business_profiles ADD COLUMN public_token TEXT"))
            print("✓ Added public_token column")

        conn.commit()

    # Backfill public_token for existing rows that have none
    db = SessionLocal()
    try:
        rows = db.execute(text(
            "SELECT id FROM business_profiles WHERE public_token IS NULL"
        )).fetchall()
        for row in rows:
            db.execute(text(
                "UPDATE business_profiles SET public_token = :token WHERE id = :id"
            ), {"token": secrets.token_urlsafe(24), "id": row[0]})
        db.commit()
        if rows:
            print(f"✓ Backfilled public_token for {len(rows)} existing business(es)")
    finally:
        db.close()

    print("Migration complete.")

if __name__ == "__main__":
    migrate()
