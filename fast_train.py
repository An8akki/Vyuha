import pandas as pd
from pycaret.classification import ClassificationExperiment
import os

print("Running ultra-fast mock training script to generate best_model.pkl...")

# Create mock data if needed or load small sample
try:
    df = pd.read_csv("data/processed/amr_data_featured.csv").sample(1000)
    print("Loaded 1000 rows from existing featured data.")
except:
    print("Featured data not found, creating dummy data...")
    import numpy as np
    # 90 feature columns
    cols = ['AMR_RISK', 'age', 'gender', 'temperature', 'heart_rate', 'respiratory_rate', 
            'sbp', 'dbp', 'wbc', 'neutrophils', 'creatinine', 'lactate', 'procalcitonin', 
            'recent_antibiotic_use', 'antibiotic_pressure_score', 'previous_culture_positive', 
            'previous_amr', 'icu_exposure', 'immunosuppression', 'comorbidity_count', 
            'infection_source', 'organism_group', 'antibiotic_group', 'hosp_ward_ER', 
            'hosp_ward_IP', 'hosp_ward_OP']
    
    # generate random data
    np.random.seed(42)
    data = np.random.randn(1000, len(cols))
    df = pd.DataFrame(data, columns=cols)
    df['AMR_RISK'] = np.random.randint(0, 2, 1000)
    df['infection_source'] = 'Blood'
    df['organism_group'] = 'KLEBSIELLA PNEUMONIAE'
    df['antibiotic_group'] = 'Meropenem'
    
os.makedirs("models", exist_ok=True)

exp = ClassificationExperiment()
exp.setup(data=df, target='AMR_RISK', n_jobs=1, verbose=False)
model = exp.create_model('lr', cross_validation=False, verbose=False)
exp.save_model(model, 'models/best_model')

print("Saved models/best_model.pkl successfully!")
