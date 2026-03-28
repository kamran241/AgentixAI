import json
from db.database import SessionLocal
from db import models

db = SessionLocal()
try:
    print("--- Audit Logs for SCHED_ALICE ---")
    logs = db.query(models.AuditLog).filter(models.AuditLog.session_id == 'SCHED_ALICE').all()
    for log in logs:
        print(f"Action: {log.action}")
        print(f"Details: {json.dumps(log.details, indent=2)}")
        print("-" * 20)
finally:
    db.close()
