# Vyuha — AMR-GUARD

🚀 **Live Deployment:** [https://vyuha-nzre.onrender.com/](https://vyuha-nzre.onrender.com/)

AMR-GUARD is a clinical decision-support prototype for antimicrobial resistance
(AMR) risk assessment. It provides separate doctor and staff workspaces for
reviewing patient records, running assessments, monitoring risk, and exploring
ward-level resistance intelligence.

> **Clinical disclaimer:** This project is a research and demonstration
> prototype. It is not a medical device and must not be used for autonomous
> diagnosis, prescribing, or treatment decisions.

## Features

- Role-based doctor and staff login flows
- Patient AMR records with culture and susceptibility information
- AMR risk assessment workflow with explainability output
- Patient monitoring and longitudinal risk charts
- Ward summaries, antibiogram views, and resistance trends
- Clinician accept/override feedback workflow
- FastAPI endpoints with Pydantic request validation
- Saved model support with a deterministic clinical-rules fallback

## Technology

| Area | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| UI | Custom CSS, Lucide React |
| Charts | Recharts |
| API client | Axios |
| Backend | FastAPI, Uvicorn, Pydantic |
| Data processing | Pandas, NumPy |
| Machine learning | CatBoost, scikit-learn, optional PyCaret pipeline |
| Explainability | SHAP |
| Authentication | Signed bearer sessions with role checks |

## Project structure

```text
.
├── src/                    React application
│   ├── api/                FastAPI client and data hydration
│   ├── components/         Landing, login, and shared layout
│   ├── context/            Portal data state
│   └── pages/              Dashboards and clinical workflows
├── Backend/
│   ├── api/                FastAPI application and routers
│   ├── models/             Serialized model artifacts
│   ├── pipeline/           Training and feature pipeline
│   ├── reports/            Evaluation metadata
│   └── scripts/            Supporting utilities
└── TECH_STACK.md           Extended implementation reference
```

## Prerequisites

- Node.js 20 or newer
- Python 3.11 or 3.12
- npm

## Run locally

### 1. Install frontend dependencies

```bash
npm install
```

### 2. Configure the clinical source files

Raw clinical CSV files are intentionally excluded from Git because of their
size and sensitivity. Place the authorized de-identified source files in
`Backend/` before starting the API:

```text
microbiology_cultures_cohort.csv
microbiology_cultures_demographics.csv
microbiology_cultures_vitals.csv
microbiology_cultures_labs.csv
microbiology_cultures_ward_info.csv
```

Only use datasets you are authorized to process. Do not commit patient data,
generated caches, or runtime clinical state.

### 3. Install and start the backend

Windows PowerShell:

```powershell
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

The API documentation is available at
[`http://127.0.0.1:8000/docs`](http://127.0.0.1:8000/docs).

The API attempts to load the saved ML pipeline at startup. When the optional
PyCaret runtime is unavailable, assessments use the built-in clinical-rules
fallback and identify that fallback in the returned model version.

### 4. Start the frontend

From the repository root, in another terminal:

```bash
npm run dev
```

Open [`http://127.0.0.1:5173`](http://127.0.0.1:5173).

The frontend uses `http://127.0.0.1:8000` by default. To use another API URL,
create a local `.env` file:

```env
VITE_API_URL=https://your-api.example.com
```

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Doctor | `doctor@amrguard.demo` | `demo1234` |
| Staff | `staff@amrguard.demo` | `demo1234` |

These seeded credentials are for local prototype use only.

## Main API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/login` | Create a role-based bearer session |
| `GET` | `/api/patients` | List patient records |
| `GET` | `/api/patients/{ehr_id}` | Read a patient record and portal state |
| `POST` | `/api/patients/{ehr_id}/assessments` | Run and persist an assessment |
| `GET` | `/api/dashboard` | Return dashboard aggregates |
| `GET` | `/api/intelligence` | Return antibiogram and trend data |
| `POST` | `/predict` | Run direct AMR risk inference |
| `POST` | `/feedback/{ehr_id}/clinician-action` | Record clinician feedback |
| `GET` | `/outbreak/forecast` | Return ward-level outbreak signals |
| `GET` | `/health` | Report API and prediction-engine status |

## Validation

Build the frontend:

```bash
npm run build
```

Compile-check the backend:

```bash
python -m compileall -q Backend/api
```

## Deployment notes

- Build the frontend with `npm run build`; Vite writes output to `dist/`.
- Deploy the FastAPI service using `Backend/Dockerfile` or an ASGI host.
- Set `VITE_API_URL` to the deployed backend URL.
- Set `AMR_CORS_ORIGINS` on the backend to a comma-separated list of allowed
  frontend origins.
- Replace seeded accounts and prototype session configuration before any
  production deployment.

For backend-specific details, see [Backend/README.md](Backend/README.md).
