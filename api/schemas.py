"""
api/schemas.py
---------------
Pydantic request and response models for the AMR Decision Support API.

The input schema accepts raw clinical values as they would appear at
point of care (before any feature engineering). The API internally
derives composite features (MAP, SIRS, etc.) before calling the model.

All fields are Optional with None default to handle incomplete data
- clinical reality is that not all tests are always available.
"""

from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field


# -----------------------------------------------------------------
# Prediction request
# -----------------------------------------------------------------

class PatientInput(BaseModel):
    """
    Clinical data for an AMR risk prediction request.
    Each field corresponds to a feature in the AMR model.
    """

    # -- Demographics ---------------------------------------------
    age:    Optional[float] = Field(None, ge=18, le=110, description="Patient age (years)")
    gender: Optional[int]   = Field(None, ge=0, le=1, description="Gender (binary: 0 or 1)")

    # -- Vitals ---------------------------------------------------
    temperature:      Optional[float] = Field(None, ge=25.0, le=45.0, description="Body temperature (°C)")
    heart_rate:       Optional[float] = Field(None, ge=0, le=400, description="Heart rate (bpm)")
    respiratory_rate: Optional[float] = Field(None, ge=0, le=80, description="Respiratory rate (breaths/min)")
    sbp:              Optional[float] = Field(None, ge=0, le=350, description="Systolic blood pressure (mmHg)")
    dbp:              Optional[float] = Field(None, ge=0, le=250, description="Diastolic blood pressure (mmHg)")

    # -- Laboratory -----------------------------------------------
    wbc:           Optional[float] = Field(None, ge=0, description="WBC count (×10⁹/L)")
    neutrophils:   Optional[float] = Field(None, ge=0, description="Neutrophils (×10⁹/L)")
    creatinine:    Optional[float] = Field(None, ge=0, description="Creatinine (mg/dL)")
    lactate:       Optional[float] = Field(None, ge=0, description="Lactate (mmol/L)")
    procalcitonin: Optional[float] = Field(None, ge=0, description="Procalcitonin (ng/mL)")

    # -- History / Exposure ---------------------------------------
    recent_antibiotic_use:     Optional[int] = Field(None, ge=0, le=1, description="Any antibiotic in last 90 days")
    antibiotic_pressure_score: Optional[int] = Field(None, ge=0, description="Number of distinct antibiotic classes (90 days)")
    previous_culture_positive: Optional[int] = Field(None, ge=0, le=1, description="Any previous positive culture")
    previous_amr:              Optional[int] = Field(None, ge=0, le=1, description="Previous AMR organism")
    icu_exposure:              Optional[int] = Field(None, ge=0, le=1, description="ICU ward at time of culture")
    immunosuppression:         Optional[int] = Field(None, ge=0, le=1, description="On immunosuppressant therapy")
    comorbidity_count:         Optional[int] = Field(None, ge=0, description="Number of distinct comorbid conditions (proxy)")

    # -- Infection context ----------------------------------------
    infection_source:     Optional[str] = Field(None, description="Culture source (e.g., Blood, Urine, Respiratory)")
    organism_group:       Optional[str] = Field(None, description="Suspected organism group")
    antibiotic_group:     Optional[str] = Field(None, description="Antibiotic being tested")
    hosp_ward_ER:         Optional[int] = Field(None, ge=0, le=1, description="Emergency department")
    hosp_ward_IP:         Optional[int] = Field(None, ge=0, le=1, description="Inpatient ward")
    hosp_ward_OP:         Optional[int] = Field(None, ge=0, le=1, description="Outpatient setting")

    class Config:
        json_schema_extra = {
            "example": {
                "age": 67,
                "gender": 1,
                "temperature": 38.7,
                "heart_rate": 112,
                "respiratory_rate": 25,
                "sbp": 92,
                "dbp": 58,
                "wbc": 17.2,
                "neutrophils": 14.8,
                "creatinine": 1.8,
                "lactate": 2.9,
                "procalcitonin": 8.4,
                "recent_antibiotic_use": 1,
                "antibiotic_pressure_score": 3,
                "previous_culture_positive": 1,
                "previous_amr": 1,
                "icu_exposure": 1,
                "immunosuppression": 0,
                "comorbidity_count": 3,
                "infection_source": "Blood",
                "organism_group": "KLEBSIELLA PNEUMONIAE",
                "antibiotic_group": "Ertapenem",
                "hosp_ward_ER": 0,
                "hosp_ward_IP": 1,
                "hosp_ward_OP": 0,
            }
        }


# -----------------------------------------------------------------
# SHAP feature contribution
# -----------------------------------------------------------------

class FeatureContribution(BaseModel):
    feature:            str
    value:              Optional[float | str | int] = None
    direction:          str   # "increases" or "decreases"
    shap_contribution:  float


# -----------------------------------------------------------------
# Prediction response
# -----------------------------------------------------------------

class PredictionResponse(BaseModel):
    # Core output
    resistance_probability: float = Field(..., description="P(AMR) in [0, 1]")
    risk_tier:              str   = Field(..., description="LOW | MODERATE | HIGH")
    risk_color:             str   = Field(..., description="green | amber | red")
    recommended_action:     str   = Field(..., description="Clinical guidance string")

    # Explainability
    top_features: List[FeatureContribution] = Field(
        default_factory=list,
        description="Top SHAP feature contributors for this prediction",
    )
    explanation: str = Field(default="", description="Narrative XAI explanation generated from SHAP")

    # Metadata
    model_version: str = Field(default="v1.0")
    disclaimer: str = Field(
        default=(
            "This is a decision-support tool. AMR probability estimates are "
            "model-derived and must be interpreted alongside culture/AST results, "
            "local antibiograms, clinical judgment, and institutional guidelines. "
            "Not for autonomous prescribing."
        )
    )


# -----------------------------------------------------------------
# Model info response
# -----------------------------------------------------------------

class ModelInfo(BaseModel):
    model_name:      str
    model_type:      str
    roc_auc:         Optional[float] = None
    pr_auc:          Optional[float] = None
    recall:          Optional[float] = None
    f1:              Optional[float] = None
    training_date:   Optional[str]   = None
    top_features:    List[dict]      = Field(default_factory=list)
    n_test_samples:  Optional[int]   = None


# -----------------------------------------------------------------
# Health check
# -----------------------------------------------------------------

class HealthResponse(BaseModel):
    status:      str = "ok"
    model_loaded: bool = False
    version:     str = "1.0.0"
