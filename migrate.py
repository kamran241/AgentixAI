"""
Schema migration — adds missing columns to business_profiles.
Safe to run multiple times (skips columns that already exist).
Works with both SQLite and PostgreSQL.

Run with: python migrate.py
"""
import json
import secrets
from sqlalchemy import text
from db.database import engine, SessionLocal

# JSON columns and the empty-value they should fall back to when the stored
# value is NULL or unparseable (e.g. a Python repr like "{'key': 'val'}").
JSON_COLS = {
    "widget_config":  "{}",
    "availability":   "{}",
    "config":         "{}",
    "capabilities":   "{}",
    "dynamic_tables": "[]",
}


def _existing_columns(conn) -> set:
    dialect = conn.dialect.name if hasattr(conn, 'dialect') else engine.dialect.name
    if dialect == 'sqlite':
        result = conn.execute(text("PRAGMA table_info(business_profiles)"))
        return {row[1] for row in result}
    else:
        result = conn.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'business_profiles' AND table_schema = 'public'"
        ))
        return {row[0] for row in result}


def _repair_json_columns(db):
    """
    Scan every business row and fix any JSON column whose stored value is
    not parseable JSON (e.g. Python repr strings, empty strings).
    NULL values are left alone — the ORM returns None and callers use `or {}`.
    """
    rows = db.execute(text("SELECT id FROM business_profiles")).fetchall()
    for (row_id,) in rows:
        for col, empty in JSON_COLS.items():
            val = db.execute(
                text(f"SELECT {col} FROM business_profiles WHERE id = :id"),
                {"id": row_id},
            ).scalar()

            if val is None:
                continue  # NULL → Python None, handled by `or {}` guards everywhere

            if isinstance(val, str):
                try:
                    json.loads(val)
                except (json.JSONDecodeError, ValueError):
                    db.execute(
                        text(f"UPDATE business_profiles SET {col} = :v WHERE id = :id"),
                        {"v": empty, "id": row_id},
                    )
                    print(f"  Repaired {col} on row {row_id} (invalid JSON)")
    db.commit()


def migrate():
    with engine.connect() as conn:
        existing = _existing_columns(conn)

        # TEXT is the correct storage type — SQLAlchemy's JSON column type handles
        # json.loads / json.dumps at the Python layer for both SQLite and PostgreSQL.
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

    db = SessionLocal()
    try:
        # Backfill public_token for rows that have none
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

        # Fix any JSON columns containing unparseable values
        _repair_json_columns(db)
    finally:
        db.close()

    print("Migration complete.")


if __name__ == "__main__":
    migrate()
