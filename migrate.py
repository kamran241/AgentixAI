"""
One-time migration: adds user_id and public_token columns to business_profiles.
Run once with: python migrate.py
"""
import secrets
from sqlalchemy import text
from db.database import engine, SessionLocal

def migrate():
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(business_profiles)"))
        existing = {row[1] for row in result}

        new_cols = {
            "user_id": "INTEGER",
            "public_token": "TEXT",
            "widget_config": "JSON",
            "pdf_filename": "TEXT",
        }
        for col, col_type in new_cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE business_profiles ADD COLUMN {col} {col_type}"))
                print(f"✓ Added {col} column")

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
