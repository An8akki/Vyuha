import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from api.mock_db import get_patient, add_timeline_event, get_db

router = APIRouter(prefix="/timeline", tags=["Timeline"])

class AntibioticExposure(BaseModel):
    antibiotic_name: str
    dose: str
    route: str

@router.post("/{ehr_id}/antibiotic")
def log_antibiotic(ehr_id: str, exposure: AntibioticExposure):
    """Log an antibiotic administration for a patient."""
    patient = get_patient(ehr_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    event = add_timeline_event(ehr_id, "ANTIBIOTIC_ADMINISTERED", exposure.model_dump())
    return {"status": "success", "event": event}

@router.get("/{ehr_id}")
def get_timeline(ehr_id: str):
    """Get the full clinical timeline for a patient."""
    patient = get_patient(ehr_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    db = get_db()
    timeline = db.get("timelines", {}).get(ehr_id, [])
    # Also fetch predictions and outcomes to merge into timeline if needed, but for now just timeline events
    
    # Sort chronological
    timeline.sort(key=lambda x: x["timestamp"])
    return {"ehr_id": ehr_id, "timeline": timeline}
