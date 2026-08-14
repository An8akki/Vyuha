import os
import json
import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

try:
    from supabase import create_client, Client
    if SUPABASE_URL and SUPABASE_KEY:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    else:
        supabase = None
except ImportError:
    supabase = None

# Fallback to mock_db if supabase is unavailable
from api.mock_db import get_all_patients as mock_get_all_patients
from api.mock_db import get_patient as mock_get_patient
from api.mock_db import add_timeline_event as mock_add_timeline
from api.mock_db import add_feedback as mock_add_feedback
from api.mock_db import add_outcome as mock_add_outcome

def get_all_patients():
    if not supabase:
        print("⚠️ Supabase not configured. Using local mock DB.")
        return mock_get_all_patients()
    
    try:
        response = supabase.table("patients").select("*").execute()
        patients_dict = {}
        for row in response.data:
            # Reconstruct the patient dictionary format
            patient_id = row.get("id")
            patients_dict[patient_id] = {
                "id": patient_id,
                "name": row.get("name"),
                "admission_date": row.get("admission_date"),
                "clinical_data": row.get("clinical_data", {})
            }
        
        # If Supabase is empty, fallback to mock DB so the UI still works
        if not patients_dict:
            print("⚠️ Supabase 'patients' table is empty. Using local mock DB.")
            return mock_get_all_patients()
            
        return patients_dict
    except Exception as e:
        print(f"⚠️ Supabase error ({e}). Using local mock DB.")
        return mock_get_all_patients()

def get_patient(ehr_id: str):
    if not supabase:
        return mock_get_patient(ehr_id)
    
    try:
        response = supabase.table("patients").select("*").eq("id", ehr_id).execute()
        if response.data:
            row = response.data[0]
            return {
                "id": row.get("id"),
                "name": row.get("name"),
                "admission_date": row.get("admission_date"),
                "clinical_data": row.get("clinical_data", {})
            }
        return mock_get_patient(ehr_id)
    except Exception:
        return mock_get_patient(ehr_id)

def add_timeline_event(ehr_id: str, event_type: str, details: dict):
    # Pass-through to mock_db for now since we haven't created a timelines table in Supabase
    return mock_add_timeline(ehr_id, event_type, details)

def add_feedback(ehr_id: str, feedback: dict):
    # Pass-through to mock_db for now
    return mock_add_feedback(ehr_id, feedback)

def add_outcome(ehr_id: str, outcome: dict):
    # Pass-through to mock_db for now
    return mock_add_outcome(ehr_id, outcome)
