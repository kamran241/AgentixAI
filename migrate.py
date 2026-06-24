"""
Schema migration — adds missing columns to business_profiles.
Safe to run multiple times (skips columns that already exist).
Works with both SQLite and PostgreSQL.

Run with: python migrate.py
"""
import secrets
from sqlalchemy import text
from db.database import engine, SessionLocal


def _existing_columns(conn) -> set:
    dialect = conn.dialect.name if hasattr(conn, 'dialect') else engine.dialect.name
    if dialect == 'sqlite':
        result = conn.execute(text("PRAGMA table_info(business_profiles)"))
        return {row[1] for row in result}
    else:
        # PostgreSQL / Neon
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'business_profiles' AND table_schema = 'public'"
        ))
        return {row[0] for row in result}


def migrate():
    with engine.connect() as conn:
        existing = _existing_columns(conn)

        new_cols = {
            "user_id":         "INTEGER",
            "public_token":    "TEXT",
            "widget_config":   "TEXT",
            "pdf_filename":    "TEXT",
            "custom_prompt":   "TEXT",
            "external_db_url": "TEXT",
            "availability":    "TEXT",
        }

        added = []
        for col, col_type in new_cols.items():
            if col not in existing:
                conn.execute(text(
                    f"ALTER TABLE business_profiles ADD COLUMN {col} {col_type}"
                ))
                added.append(col)
                print(f"  + Added column: {col}")

        conn.commit()

        if not added:
            print("  Nothing to migrate — all columns already exist.")

    # Backfill public_token for rows that have none
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
            print(f"  Backfilled public_token for {len(rows)} row(s).")
    finally:
        db.close()

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
