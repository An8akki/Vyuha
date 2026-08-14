import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, List
import random

from api.supabase_db import get_all_patients, get_patient
from api.predictor import predictor, PatientInput
from api.routers.outbreak import get_ward_forecast

router = APIRouter()

# ---------------------------------------------------------
# Models for Frontend Expected Payloads
# ---------------------------------------------------------
class LoginRequest(BaseModel):
    role: str
    email: str
    password: str

# ---------------------------------------------------------
# 1. Dummy Login Endpoint
# ---------------------------------------------------------
@router.post("/auth/login")
async def dummy_login(req: LoginRequest):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    return {
        "access_token": "dummy_jwt_token_for_hackathon",
        "user": {
            "role": req.role,
            "name": "Dr. Smith",
            "short_name": "Smith",
            "initials": "DS",
            "title": "Lead Consultant",
            "department": "Infectious Diseases"
        }
    }

# ---------------------------------------------------------
# 2. Get All Patients for Dashboard
# ---------------------------------------------------------
@router.get("/api/patients")
async def get_patients_for_ui():
    patients_dict = get_all_patients()
    items = []
    
    for pid, pdata in patients_dict.items():
        score = pdata.get("latest_risk_score", 55)
        level = pdata.get("risk_level", ("high" if score >= 70 else "medium" if score >= 40 else "low"))
        item = {
            "id": pdata["id"],
            "name": pdata["name"],
            "admission_date": pdata["admission_date"],
            "clinical_data": pdata["clinical_data"],
            "risk_score": score,
            "risk_level": level,
            "ward": pdata.get("ward", "General Ward"),
        }
        items.append(item)
        
    return {"items": items}

# ---------------------------------------------------------
# 3. Dashboard Statistics Aggregation
# ---------------------------------------------------------
@router.get("/api/dashboard")
async def get_dashboard_stats():
    patients_dict = get_all_patients()
    
    total = len(patients_dict)
    high_risk_count = 0
    wards = {}
    
    for pid, pdata in patients_dict.items():
        score = pdata.get("latest_risk_score", random.randint(20, 85))
        is_high = score >= 70
        if is_high:
            high_risk_count += 1
            
        ward = pdata.get("ward", "General Ward")
        if ward not in wards:
            wards[ward] = {"ward": ward, "patients_assessed": 0, "high_risk": 0, "sum_risk": 0}
        
        wards[ward]["patients_assessed"] += 1
        wards[ward]["sum_risk"] += score
        if is_high:
            wards[ward]["high_risk"] += 1
            
    ward_list = []
    for w, wdata in wards.items():
        avg = int(wdata["sum_risk"] / wdata["patients_assessed"]) if wdata["patients_assessed"] > 0 else 0
        ward_list.append({
            "ward": w,
            "patients_assessed": wdata["patients_assessed"],
            "high_risk": wdata["high_risk"],
            "avg_risk": avg,
            "risk": "high" if avg >= 70 else "medium" if avg >= 40 else "low"
        })
        
    return {
        "stats": {
            "patients_assessed": total,
            "high_risk": high_risk_count,
            "under_monitoring": total - high_risk_count,
            "new_alerts": high_risk_count // 2  # mock
        },
        "wards": ward_list
    }

# ---------------------------------------------------------
# 4. Assess Patient (Wrapper around Predict)
# ---------------------------------------------------------
@router.post("/api/patients/{ehr_id}/assessments")
async def assess_patient_ui(ehr_id: str, clinical_data: Dict[str, Any]):
    # The UI sends raw clinical data. We pass it to our ML predict function.
    try:
        # Convert dictionary to PatientInput pydantic model
        patient_input = PatientInput(**clinical_data)
        
        # Call the actual ML model function
        prediction_result = predictor.predict(patient_input)
        
        # The UI expects the result back to just be the JSON, it will store it.
        return prediction_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# ---------------------------------------------------------
# 5. Intelligence / Outbreak Forecast Wrapper
# ---------------------------------------------------------
@router.get("/api/intelligence")
async def get_intelligence_ui(ward: str = "ICU", organism: str = "PSEUDOMONAS"):
    # We call our outbreak module
    forecast = get_ward_forecast(ward_id=ward)
    
    # We map the outbreak response to the format Vyuha expects:
    # { antibiogram: [...], trend: [...] }
    
    # Create some mock trend data based on the forecast prevalence
    trend = []
    if "ward_statistics" in forecast:
        for w, stats in forecast["ward_statistics"].items():
            trend.append({"day": "Today", "pressure": stats.get("high_risk_patients", 0), "forecast": False})
            
    return {
        "antibiogram": [
            {"antibiotic": "Meropenem", "susceptible": 45, "resistant": 55, "trend": "up"},
            {"antibiotic": "Ciprofloxacin", "susceptible": 20, "resistant": 80, "trend": "up"}
        ],
        "trend": trend
    }

# ---------------------------------------------------------
# 6. Clinician Action / Override Feedback
# ---------------------------------------------------------
class ClinicianActionRequest(BaseModel):
    prediction_id: str
    action: str
    reason: str = None

@router.post("/feedback/{ehr_id}/clinician-action")
async def submit_clinician_action(ehr_id: str, request: ClinicianActionRequest):
    # In a real app, this would write the override to the database for model retraining
    return {"status": "success", "action": request.action, "reason": request.reason}
