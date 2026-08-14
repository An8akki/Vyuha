from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from api.mock_db import get_patient, add_feedback, add_outcome

router = APIRouter(prefix="/feedback", tags=["Governance & Feedback"])

class ClinicianFeedback(BaseModel):
    prediction_id: str
    action: str  # "accept" or "override"
    reason: Optional[str] = None
    drug_prescribed: Optional[str] = None

class CultureOutcome(BaseModel):
    organism_identified: str
    resistance_profile: str  # e.g. "Susceptible", "MDR", "ESBL"
    is_amr: int  # 0 or 1

@router.post("/{ehr_id}/clinician-action")
def log_clinician_action(ehr_id: str, feedback: ClinicianFeedback):
    """Log whether the clinician accepted or overrode the AI's recommendation."""
    patient = get_patient(ehr_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    record = add_feedback(ehr_id, feedback.model_dump())
    return {"status": "success", "feedback": record}

@router.post("/{ehr_id}/outcome")
def log_culture_outcome(ehr_id: str, outcome: CultureOutcome):
    """Log the final Ground Truth culture results to evaluate the model's accuracy later."""
    patient = get_patient(ehr_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    record = add_outcome(ehr_id, outcome.model_dump())
    return {"status": "success", "outcome": record}
