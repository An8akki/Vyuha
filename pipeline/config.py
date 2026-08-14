"""
pipeline/config.py
------------------
Central configuration for the AMR Decision Support ML Pipeline.
All tunable constants live here so that no magic numbers appear in logic files.
"""

from pathlib import Path

# -----------------------------------------------------------------
# Root paths
# -----------------------------------------------------------------
DATA_DIR    = Path("d:/Works/AMR")
MODELS_DIR  = DATA_DIR / "models"
REPORTS_DIR = DATA_DIR / "reports"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------
# CSV filenames
# -----------------------------------------------------------------
CSV = {
    "cohort":          DATA_DIR / "microbiology_cultures_cohort.csv",
    "demographics":    DATA_DIR / "microbiology_cultures_demographics.csv",
    "vitals":          DATA_DIR / "microbiology_cultures_vitals.csv",
    "labs":            DATA_DIR / "microbiology_cultures_labs.csv",
    "ward_info":       DATA_DIR / "microbiology_cultures_ward_info.csv",
    "prior_med":       DATA_DIR / "microbiology_cultures_prior_med.csv",
    "procedures":      DATA_DIR / "microbiology_cultures_priorprocedures.csv",
    "prior_organism":  DATA_DIR / "microbiology_culture_prior_infecting_organism.csv",
    "abx_class":       DATA_DIR / "microbiology_cultures_antibiotic_class_exposure.csv",
    "implied_rules":   DATA_DIR / "implied_susceptibility_rules.csv",
}

# -----------------------------------------------------------------
# Sampling (hackathon speed)
# -----------------------------------------------------------------
COHORT_SAMPLE_ROWS  = 300_000      # max rows from cohort
RANDOM_STATE        = 42
NULL_VALUES         = ["Null", "null", "NULL", "", "nan", "NaN", "NA"]

# -----------------------------------------------------------------
# Label definition
# -----------------------------------------------------------------
TARGET_COL       = "AMR_RISK"
RESISTANT_LABEL  = "Resistant"       # susceptibility value -> 1
# "Susceptible" and "Intermediate" -> 0

# -----------------------------------------------------------------
# Join keys
# -----------------------------------------------------------------
PATIENT_ID_COL    = "anon_id"
ENCOUNTER_ID_COL  = "pat_enc_csn_id_coded"
ORDER_ID_COL      = "order_proc_id_coded"

# -----------------------------------------------------------------
# Patient-level split (avoids patient leakage across train/test)
# -----------------------------------------------------------------
TRAIN_FRAC = 0.70
VAL_FRAC   = 0.15
TEST_FRAC  = 0.15

# -----------------------------------------------------------------
# Clinical valid ranges for outlier capping
# (outside range -> cap to boundary, not dropped)
# -----------------------------------------------------------------
CLINICAL_RANGES: dict[str, tuple[float, float]] = {
    "temperature":      (32.0, 43.0),
    "heart_rate":       (20.0, 300.0),
    "respiratory_rate": (4.0,  60.0),
    "sbp":              (40.0, 300.0),
    "dbp":              (20.0, 200.0),
    "wbc":              (0.1,  100.0),
    "neutrophils":      (0.0,  50.0),
    "creatinine":       (0.1,  30.0),
    "lactate":          (0.1,  30.0),
    "procalcitonin":    (0.0,  1000.0),
}

# -----------------------------------------------------------------
# Clinical decision thresholds (for derived features)
# -----------------------------------------------------------------
FEVER_THRESHOLD         = 38.0    # °C
HYPOTHERMIA_THRESHOLD   = 36.0   # °C
TACHYCARDIA_THRESHOLD   = 100    # bpm
TACHYPNEA_THRESHOLD     = 20     # breaths/min
HYPOTENSION_SBP         = 90     # mmHg
WBC_HIGH                = 12.0   # ×10⁹/L
WBC_LOW                 = 4.0    # ×10⁹/L
CREATININE_HIGH         = 1.2    # mg/dL
LACTATE_HIGH            = 2.0    # mmol/L
PROCALCITONIN_HIGH      = 0.5    # ng/mL

# -----------------------------------------------------------------
# History look-back windows (days before culture order)
# Negative = before culture; time_to_culturetime format
# -----------------------------------------------------------------
PRIOR_ABX_WINDOW_DAYS        = -90
PRIOR_PROCEDURE_WINDOW_DAYS  = -30
PRIOR_ORGANISM_WINDOW_DAYS   = -365

# -----------------------------------------------------------------
# Dimensionality control for pivoted one-hot features
# -----------------------------------------------------------------
TOP_ORGANISMS          = 15
TOP_ABX_CATEGORIES     = 10
TOP_PROCEDURES         = 8

# Minimum missingness indicator columns (always add indicator for these)
MISSINGNESS_INDICATOR_COLS = [
    "wbc", "neutrophils", "creatinine", "lactate", "procalcitonin",
    "temperature", "heart_rate", "sbp", "dbp"
]

# -----------------------------------------------------------------
# AMR risk output thresholds
# NOTE: These are prototype values. For clinical deployment, thresholds
# must be validated from calibration curves and clinical utility analysis.
# -----------------------------------------------------------------
RISK_THRESHOLDS = {
    "LOW":      0.30,
    "MODERATE": 0.70,
}

RISK_ACTIONS = {
    "LOW":      "Standard empiric coverage likely adequate. Monitor culture results.",
    "MODERATE": "Consider broadened antimicrobial coverage. Review local antibiogram.",
    "HIGH":     "High AMR risk. Escalate antimicrobial strategy. Await culture/AST urgently.",
}

# -----------------------------------------------------------------
# PyCaret training settings
# -----------------------------------------------------------------
PYCARET_FOLD          = 5
PYCARET_TUNE_ITER     = 30
PYCARET_SORT_METRIC   = "AUC"

MODELS_TO_COMPARE = ["lr", "rf", "xgboost", "lightgbm", "catboost"]

# -----------------------------------------------------------------
# Model selection: clinical penalty for high false-negative rate
# FNR > this value -> penalize model score by PENALTY_FACTOR
# -----------------------------------------------------------------
FNR_PENALTY_THRESHOLD = 0.30    # penalize if >30% AMR cases missed
FNR_PENALTY_FACTOR    = 0.10    # subtract 0.10 from composite score

# -----------------------------------------------------------------
# FastAPI
# -----------------------------------------------------------------
API_HOST = "0.0.0.0"
API_PORT = 8000
MODEL_ARTIFACT_PATH = MODELS_DIR / "best_model"
