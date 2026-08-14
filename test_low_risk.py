import requests

payload = {
  "age": 28.0,
  "gender": 0,
  "temperature": 37.1,
  "heart_rate": 78.0,
  "respiratory_rate": 16.0,
  "sbp": 120.0,
  "dbp": 80.0,
  "wbc": 6.8,
  "neutrophils": 4.5,
  "creatinine": 0.8,
  "lactate": 1.1,
  "procalcitonin": 0.05,
  "recent_antibiotic_use": 0,
  "antibiotic_pressure_score": 0,
  "previous_culture_positive": 0,
  "previous_amr": 0,
  "icu_exposure": 0,
  "immunosuppression": 0,
  "comorbidity_count": 0,
  "infection_source": "Urine",
  "organism_group": "ESCHERICHIA COLI",
  "antibiotic_group": "Ceftriaxone",
  "hosp_ward_ER": 0,
  "hosp_ward_IP": 0,
  "hosp_ward_OP": 1
}

res = requests.post("http://127.0.0.1:8000/predict", json=payload)
print(res.json())
