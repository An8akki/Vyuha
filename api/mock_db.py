import json
import threading
import datetime
from pathlib import Path

DB_FILE = Path(__file__).parent / "mock_supabase_db.json"
db_lock = threading.Lock()

def get_db():
    with db_lock:
        if not DB_FILE.exists():
            return {}
        with open(DB_FILE, "r") as f:
            return json.load(f)

def save_db(data):
    with db_lock:
        with open(DB_FILE, "w") as f:
            json.dump(data, f, indent=2)

def get_patient(ehr_id: str):
    db = get_db()
    return db.get("patients", {}).get(ehr_id)

def add_timeline_event(ehr_id: str, event_type: str, details: dict):
    db = get_db()
    if ehr_id not in db.get("timelines", {}):
        db.setdefault("timelines", {})[ehr_id] = []
    
    event = {
        "type": event_type,
        "details": details,
        "timestamp": datetime.datetime.now().isoformat()
    }
    db["timelines"][ehr_id].append(event)
    save_db(db)
    return event

def add_feedback(ehr_id: str, feedback: dict):
    db = get_db()
    if ehr_id not in db.get("feedback", {}):
        db.setdefault("feedback", {})[ehr_id] = []
    
    feedback["timestamp"] = datetime.datetime.now().isoformat()
    db["feedback"][ehr_id].append(feedback)
    save_db(db)
    return feedback

def add_outcome(ehr_id: str, outcome: dict):
    db = get_db()
    if ehr_id not in db.get("outcomes", {}):
        db.setdefault("outcomes", {})[ehr_id] = []
    
    outcome["timestamp"] = datetime.datetime.now().isoformat()
    db["outcomes"][ehr_id].append(outcome)
    save_db(db)
    return outcome

def get_all_patients():
    db = get_db()
    return db.get("patients", {})
