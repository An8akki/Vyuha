import json
import random
import uuid
import datetime
from pathlib import Path

# Try to use faker, otherwise use basic names
try:
    from faker import Faker
    fake = Faker()
except ImportError:
    class DummyFaker:
        def name(self):
            return f"Patient {random.randint(1000, 9999)}"
    fake = DummyFaker()

def generate_patient(is_high_risk: bool):
    """Generate realistic-ish clinical data matching PatientInput schema."""
    age = random.uniform(20, 90)
    gender = random.randint(0, 1)
    
    if is_high_risk:
        temp = random.uniform(38.5, 40.0)
        hr = random.uniform(100, 140)
        rr = random.uniform(22, 35)
        sbp = random.uniform(70, 90)
        dbp = random.uniform(40, 60)
        wbc = random.uniform(15, 30)
        lactate = random.uniform(2.5, 8.0)
        pct = random.uniform(2.0, 20.0)
        icu = 1
        prev_amr = 1
        source = random.choice(["Blood", "Respiratory"])
        org = random.choice(["KLEBSIELLA PNEUMONIAE", "PSEUDOMONAS AERUGINOSA", "ACINETOBACTER BAUMANNII"])
    else:
        temp = random.uniform(36.5, 37.5)
        hr = random.uniform(60, 90)
        rr = random.uniform(12, 18)
        sbp = random.uniform(110, 140)
        dbp = random.uniform(70, 90)
        wbc = random.uniform(4.5, 10.0)
        lactate = random.uniform(0.5, 1.5)
        pct = random.uniform(0.01, 0.1)
        icu = 0
        prev_amr = 0
        source = random.choice(["Urine", "Skin"])
        org = random.choice(["ESCHERICHIA COLI", "STAPHYLOCOCCUS AUREUS"])

    # Basic values
    neu = wbc * random.uniform(0.5, 0.85)
    cr = random.uniform(0.6, 1.2) if not is_high_risk else random.uniform(1.5, 4.0)

    return {
        "age": round(age, 1),
        "gender": gender,
        "temperature": round(temp, 1),
        "heart_rate": round(hr, 1),
        "respiratory_rate": round(rr, 1),
        "sbp": round(sbp, 1),
        "dbp": round(dbp, 1),
        "wbc": round(wbc, 1),
        "neutrophils": round(neu, 1),
        "creatinine": round(cr, 2),
        "lactate": round(lactate, 2),
        "procalcitonin": round(pct, 2),
        "recent_antibiotic_use": random.randint(0, 1) if not is_high_risk else 1,
        "antibiotic_pressure_score": random.randint(0, 2) if not is_high_risk else random.randint(2, 6),
        "previous_culture_positive": random.randint(0, 1) if not is_high_risk else 1,
        "previous_amr": prev_amr,
        "icu_exposure": icu,
        "immunosuppression": random.randint(0, 1) if is_high_risk else 0,
        "comorbidity_count": random.randint(0, 2) if not is_high_risk else random.randint(2, 5),
        "infection_source": source,
        "organism_group": org,
        "antibiotic_group": "Meropenem" if is_high_risk else "Ceftriaxone",
        "hosp_ward_ER": 0,
        "hosp_ward_IP": 1 if is_high_risk else 0,
        "hosp_ward_OP": 0 if is_high_risk else 1
    }

def main():
    db = {
        "patients": {},
        "timelines": {},       # Map of patient_id -> list of antibiotic/event records
        "feedback": {},        # Map of patient_id -> feedback records
        "predictions": {},     # Map of prediction_id -> prediction results
        "outcomes": {}         # Map of patient_id -> culture outcome
    }

    # Generate 50 patients
    for i in range(50):
        # 20% high risk
        is_high_risk = random.random() < 0.2
        
        ehr_id = f"EHR-{uuid.uuid4().hex[:8].upper()}"
        patient_record = {
            "id": ehr_id,
            "name": fake.name(),
            "admission_date": (datetime.datetime.now() - datetime.timedelta(days=random.randint(1, 10))).isoformat(),
            "clinical_data": generate_patient(is_high_risk)
        }
        
        db["patients"][ehr_id] = patient_record
        db["timelines"][ehr_id] = []
        db["feedback"][ehr_id] = []
        db["outcomes"][ehr_id] = []

    # Ensure output directory exists
    Path("api").mkdir(exist_ok=True)
    out_path = Path("api/mock_supabase_db.json")
    
    with open(out_path, "w") as f:
        json.dump(db, f, indent=2)
        
    print(f"Generated {len(db['patients'])} mock patients into {out_path}")

if __name__ == "__main__":
    main()
