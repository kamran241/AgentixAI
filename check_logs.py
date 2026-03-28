from db.database import SessionLocal, engine
from db import models
import json

db = SessionLocal()
try:
    print("--- Session Logs ---")
    sessions = db.query(models.Session).all()
    for s in sessions:
        print(f"Session {s.id}:")
        history = s.history or []
        for msg in history:
            print(f"  {msg['type']}: {msg.get('content')[:100]}...")
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
