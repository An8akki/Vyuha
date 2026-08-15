# AMR Clinical Decision Support System (CDSS) - Backend API

[![Vyuha Demo Video](https://img.youtube.com/vi/zcnRFvI7m3M/0.jpg)](https://youtu.be/zcnRFvI7m3M)
*(Click the image above to watch the full Video Demonstration)*

This repository contains the Machine Learning Backend and Clinical Decision Support System (CDSS) for the AMR (Antimicrobial Resistance) prediction tool. 

The backend is built with **FastAPI** and uses a **CatBoost** machine learning model to predict the probability of a patient having a drug-resistant infection based on their clinical presentation (demographics, vitals, labs, and history).

---

## 🚀 Features for the Frontend Team
This backend acts as a full CDSS, exposing REST API endpoints for the frontend to consume:

1. **AMR Risk Prediction & XAI:** (`POST /predict`)
   - Accepts patient vitals/labs.
   - Returns risk probability, risk tier (LOW/MODERATE/HIGH), and a natural language explanation (XAI) generated from SHAP values explaining *why* the AI made that decision.
2. **Clinical Timelines:** (`GET /timeline/{ehr_id}`)
   - Fetches chronological events (e.g., when antibiotics were administered).
3. **Clinician Governance:** (`POST /feedback/{ehr_id}/clinician-action`)
   - Allows the clinician to accept or override the AI's recommendation from the UI, tracking model drift and clinician trust.
4. **Continuous Risk Monitoring:** (`POST /monitoring/{ehr_id}/vitals-batch`)
   - Accepts an array of timeseries vitals (e.g., hourly updates from bedside monitors) and returns an array of risk trends over time.
5. **Epidemiological Outbreak Forecasting:** (`GET /outbreak/forecast`)
   - Aggregates high-risk patients across hospital wards to alert administrators of spiking AMR incidence.

---

## 🛠️ Tech Stack
- **API Framework:** FastAPI, Uvicorn
- **Machine Learning:** CatBoost, Scikit-Learn
- **Explainable AI:** SHAP
- **Current Database:** In-memory Mock JSON (`api/mock_supabase_db.json`). *Note: Designed to be hot-swapped for a real Supabase PostgreSQL database before production.*
- **Deployment:** Docker

---

## 💻 How to Run Locally

### 1. Install Dependencies
Make sure you have Python 3.9+ installed.
```bash
pip install -r requirements.txt
```

### 2. Start the Server
```bash
python -m uvicorn api.main:app --port 8000
```
*The server will load the ML model into memory on startup.*

### 3. View API Documentation
Open your browser and navigate to:
👉 **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**

This Swagger UI provides interactive documentation. You can see the exact JSON schema required for every endpoint, and click **"Try it out"** to test requests directly in the browser!

*(For demo data, grab any `EHR-ID` from `api/mock_supabase_db.json` and plug it into the Swagger UI path parameters).*

---

## 🐳 Docker Deployment
When you are ready to integrate the Frontend and Backend together, you can containerize this API:
```bash
docker build -t amr-backend .
docker run -p 8000:8000 amr-backend
```

---

## 🔐 Frontend Prototype Authentication
The frontend prototype uses strict local environment variables to authenticate users. To run the frontend locally or deploy it to a service like Render, you **must** configure these variables.

Create a `.env.local` file in the `Vyuha/` frontend directory (or add them to your deployment dashboard):
```env
VITE_STAFF_EMAIL=staff@amrguard.demo
VITE_STAFF_PASSWORD=demo1234
VITE_DOCTOR_EMAIL=doctor@amrguard.demo
VITE_DOCTOR_PASSWORD=demo1234
```
