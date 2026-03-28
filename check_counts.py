from db.database import SessionLocal
from db import models

db = SessionLocal()
try:
    print(f"Total Appointments: {db.query(models.Appointment).count()}")
    for a in db.query(models.Appointment).all():
        print(f"Appointment {a.id}: {a.customer_name} at {a.appointment_time} (Session {a.session_id})")
        
    print(f"Total Orders: {db.query(models.Order).count()}")
    for o in db.query(models.Order).all():
        print(f"Order {o.id}: {o.total_price} (Session {o.session_id})")
finally:
    db.close()
