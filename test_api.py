import requests
import json

def main():
    print("Testing AMR Decision Support API...")
    url = "http://127.0.0.1:8000/predict"
    
    # Sample High-Risk Patient (ICU, recent antibiotics, fever, tachycardia, high WBC)
    patient_data = {
        "age": 72.5,
        "gender": 1,
        "temperature": 39.2,
        "heart_rate": 115.0,
        "respiratory_rate": 28.0,
        "sbp": 85.0,
        "dbp": 50.0,
        "wbc": 22.4,
        "neutrophils": 19.5,
        "creatinine": 2.1,
        "lactate": 3.8,
        "procalcitonin": 12.5,
        "recent_antibiotic_use": 1,
        "antibiotic_pressure_score": 4,
        "previous_culture_positive": 1,
        "previous_amr": 1,
        "icu_exposure": 1,
        "immunosuppression": 1,
        "comorbidity_count": 3,
        "infection_source": "Blood",
        "organism_group": "KLEBSIELLA PNEUMONIAE",
        "antibiotic_group": "Meropenem",
        "hosp_ward_ER": 0,
        "hosp_ward_IP": 1,
        "hosp_ward_OP": 0
    }

    print(f"\nSending POST request to {url}")
    print("Payload:")
    print(json.dumps(patient_data, indent=2))
    
    try:
        response = requests.post(url, json=patient_data)
        response.raise_for_status()
        
        print("\n--- API RESPONSE ---")
        result = response.json()
        print(f"Resistance Probability: {result['resistance_probability']:.2%}")
        print(f"Risk Tier:              {result['risk_tier']}")
        print(f"Risk Color:             {result['risk_color']}")
        print(f"Recommended Action:     {result['recommended_action']}")
        
        print("\nTop Contributing Factors (SHAP):")
        for f in result['top_features']:
            print(f"  - {f['feature']} ({f['value']}): {f['shap_contribution']:.4f} ({f['direction']} risk)")
            
    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Connection failed. Make sure the API is running with:")
        print("uvicorn api.main:app --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"\n[ERROR] Request failed: {e}")
        if 'response' in locals():
            print(response.text)

if __name__ == "__main__":
    main()
