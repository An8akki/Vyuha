from fastapi import APIRouter
from typing import Optional
from api.mock_db import get_all_patients

router = APIRouter(prefix="/outbreak", tags=["Outbreak Forecasting"])

@router.get("/forecast")
def get_ward_forecast(ward_id: Optional[str] = None):
    """
    Simulate an epidemiological forecast by aggregating high-risk predictions
    and recent culture outcomes across patients in different wards.
    """
    patients = get_all_patients()
    
    # In a real app, this would use an ARIMA or Prophet model on historical outcomes.
    # Here we simulate aggregating current patient states from the mock DB.
    
    ward_counts = {}
    
    for ehr_id, data in patients.items():
        clinical = data.get("clinical_data", {})
        if clinical.get("hosp_ward_IP") == 1:
            ward = "Inpatient (IP)"
        elif clinical.get("hosp_ward_ER") == 1:
            ward = "Emergency (ER)"
        else:
            ward = "Outpatient (OP)"
            
        is_high_risk = clinical.get("previous_amr") == 1 or clinical.get("antibiotic_pressure_score", 0) >= 3
        
        if ward not in ward_counts:
            ward_counts[ward] = {"total_patients": 0, "high_risk_patients": 0}
            
        ward_counts[ward]["total_patients"] += 1
        if is_high_risk:
            ward_counts[ward]["high_risk_patients"] += 1
            
    alerts = []
    for ward, stats in ward_counts.items():
        prevalence = stats["high_risk_patients"] / max(stats["total_patients"], 1)
        if prevalence > 0.3:
            alerts.append({
                "ward": ward,
                "status": "ELEVATED_RISK",
                "prevalence": round(prevalence * 100, 1),
                "message": f"Spiking AMR incidence detected in {ward}. Infection control protocols recommended."
            })
            
    return {
        "status": "success",
        "active_alerts": alerts,
        "ward_statistics": ward_counts
    }
