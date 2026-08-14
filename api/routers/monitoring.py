from fastapi import APIRouter, HTTPException
from typing import List
from api.schemas import PatientInput
from api.predictor import predictor
from api.mock_db import get_patient

router = APIRouter(prefix="/monitoring", tags=["Continuous Risk Monitoring"])

@router.post("/{ehr_id}/vitals-batch")
def process_vitals_timeseries(ehr_id: str, vitals_series: List[PatientInput]):
    """
    Accepts an array of chronologically ordered patient clinical states (e.g. hourly vitals updates).
    Iterates the predictive model over the timeseries to generate continuous risk probabilities.
    """
    patient = get_patient(ehr_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    risk_trend = []
    
    for idx, state in enumerate(vitals_series):
        # Predict using the loaded model singleton
        pred = predictor.predict(state)
        
        risk_trend.append({
            "timestamp_index": idx,
            "resistance_probability": pred.resistance_probability,
            "risk_tier": pred.risk_tier,
            "risk_color": pred.risk_color
        })
        
    return {
        "ehr_id": ehr_id,
        "risk_trend": risk_trend
    }
