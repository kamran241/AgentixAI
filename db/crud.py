from sqlalchemy.orm import Session
from . import models
from datetime import datetime
import json

def create_audit_log(db: Session, action: str, details: dict, session_id: str = None):
    log = models.AuditLog(action=action, details=details, session_id=session_id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_session(db: Session, session_id: str):
    return db.query(models.Session).filter(models.Session.id == session_id).first()

def create_session(db: Session, session_id: str):
    db_session = models.Session(id=session_id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

def update_session_history(db: Session, session_id: str, history: list):
    db_session = get_session(db, session_id)
    if db_session:
        db_session.history = history
        db.commit()

def create_order(db: Session, session_id: str, total_price: float, details: dict):
    db_order = models.Order(session_id=session_id, total_price=total_price, order_details=details)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

def create_appointment(db: Session, session_id: str, service: str, time: datetime, customer_name: str = None, customer_phone: str = None):
    # Check if an appointment already exists for this session to update it instead of creating a new one
    db_apt = db.query(models.Appointment).filter(models.Appointment.session_id == session_id).first()
    
    if db_apt:
        db_apt.service_name = service
        db_apt.appointment_time = time
        db_apt.customer_name = customer_name
        db_apt.customer_phone = customer_phone
        db_apt.status = "booked" # Reset status if it was cancelled
    else:
        db_apt = models.Appointment(
            session_id=session_id, 
            service_name=service, 
            appointment_time=time,
            customer_name=customer_name,
            customer_phone=customer_phone
        )
        db.add(db_apt)
    
    db.commit()
    db.refresh(db_apt)
    return db_apt

def create_dynamic_table(db: Session, table_name: str, columns: list):
    """Executes DDL to create a business-specific table in the database."""
    from sqlalchemy import text
    
    # Sanitize table name to be safe for SQL
    table_name = "".join([c for c in table_name if c.isalnum() or c == "_"])
    
    # Build columns definitions based on database dialect
    if db.bind.dialect.name == "postgresql":
        id_col = "id SERIAL PRIMARY KEY"
        timestamp_type = "TIMESTAMP"
    else:
        id_col = "id INTEGER PRIMARY KEY AUTOINCREMENT"
        timestamp_type = "DATETIME"

    # We always include session_id to link it back to the core data
    col_defs = [id_col, "session_id TEXT"]
    for col in columns:
        # col is a dict like {'name': '...', 'type': '...'}
        safe_name = "".join([c for c in col['name'] if c.isalnum() or c == "_"])
        
        # Convert dialect-specific types
        ctype = col['type'].upper()
        if db.bind.dialect.name == "postgresql":
            if ctype == "DATETIME": ctype = "TIMESTAMP"
            if ctype == "REAL": ctype = "DOUBLE PRECISION"
            
        col_defs.append(f"{safe_name} {ctype}")
        
    col_defs.append(f"created_at {timestamp_type} DEFAULT CURRENT_TIMESTAMP")
    
    schema_str = ", ".join(col_defs)
    sql = f"CREATE TABLE IF NOT EXISTS {table_name} ({schema_str})"
    
    db.execute(text(sql))
    db.commit()
    return table_name

def delete_all_dynamic_tables(db: Session):
    """Drops any custom tables created for previous businesses."""
    from sqlalchemy import text
    # Get current dynamic table if any
    profile = db.query(models.BusinessProfile).first()
    if profile and profile.dynamic_table_name:
        try:
            db.execute(text(f"DROP TABLE IF EXISTS {profile.dynamic_table_name}"))
            db.commit()
            print(f"Dropped old table: {profile.dynamic_table_name}")
        except Exception as e:
            print(f"Error dropping table: {e}")

def clear_business_data(db: Session):
    """Wipes all data related to the previous business to prepare for a new one."""
    # 1. Drop old dynamic tables
    delete_all_dynamic_tables(db)
    
    # 2. Clear core tables gracefully (checks if table exists first)
    from sqlalchemy import inspect
    inspector = inspect(db.bind)
    tables = inspector.get_table_names()

    if "orders" in tables: db.query(models.Order).delete()
    if "appointments" in tables: db.query(models.Appointment).delete()
    if "audit_logs" in tables: db.query(models.AuditLog).delete()
    if "business_profiles" in tables: db.query(models.BusinessProfile).delete()
    if "sessions" in tables: db.query(models.Session).delete()
    
    db.commit()

def update_business_profile(db: Session, name: str, b_type: str, description: str, config: list, dynamic_table: str = None):
    # Create the new profile
    profile = models.BusinessProfile(
        name=name, 
        business_type=b_type, 
        description=description, 
        config=config,
        dynamic_table_name=dynamic_table
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile

def insert_dynamic_data(db: Session, table_name: str, session_id: str, data: dict):
    """Inserts or updates a row in a dynamic table based on session_id."""
    from sqlalchemy import text
    
    # 1. Get existing columns for this table
    table_name = "".join([c for c in table_name if c.isalnum() or c == "_"])
    
    if db.bind.dialect.name == "postgresql":
        res = db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}'"))
        cols = [r[0] for r in res]
    else:
        res = db.execute(text(f"PRAGMA table_info({table_name})"))
        cols = [r[1] for r in res]
    
    # 2. Filter data
    safe_data = {"session_id": session_id}
    for k, v in data.items():
        clean_key = k.lower().replace(" ", "_")
        if clean_key in cols:
            if isinstance(v, (list, dict)):
                safe_data[clean_key] = json.dumps(v)
            else:
                safe_data[clean_key] = v
    
    # 3. Check for existence to determine if UPSERT is needed
    exists = db.execute(text(f"SELECT 1 FROM {table_name} WHERE session_id = :sid"), {"sid": session_id}).fetchone()
    
    if exists:
        # UPDATE
        set_clause = ", ".join([f"{k} = :{k}" for k in safe_data.keys() if k != "session_id"])
        sql = f"UPDATE {table_name} SET {set_clause} WHERE session_id = :session_id"
    else:
        # INSERT
        keys = ", ".join(safe_data.keys())
        placeholders = ", ".join([f":{k}" for k in safe_data.keys()])
        sql = f"INSERT INTO {table_name} ({keys}) VALUES ({placeholders})"
    
    db.execute(text(sql), safe_data)
    db.commit()
    return True

def update_order(db: Session, order_id: int, total_price: float, details: dict):
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if db_order:
        db_order.total_price = total_price
        db_order.order_details = details
        db.commit()
        db.refresh(db_order)
    return db_order

def delete_order(db: Session, order_id: int):
    db_order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if db_order:
        db.delete(db_order)
        db.commit()
        return True
    return False

def update_appointment_status(db: Session, apt_id: int, status: str):
    apt = db.query(models.Appointment).filter(models.Appointment.id == apt_id).first()
    if apt:
        apt.status = status
        db.commit()
        db.refresh(apt)
    return apt

def update_order_status(db: Session, order_id: int, status: str):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if order:
        order.status = status
        db.commit()
        db.refresh(order)
    return order
