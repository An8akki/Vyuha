# AMR-GUARD Technology Stack

This is the agreed implementation baseline for the project.

| Layer | Technology | Project use |
| --- | --- | --- |
| Frontend | React + Vite | Staff portal, doctor portal, dashboards, patient records |
| Styling | Tailwind CSS | Fast, consistent UI |
| UI components | shadcn/ui or custom React components | Forms, cards, dialogs, tables |
| Icons | Lucide React | Clinical and navigation icons |
| Charts | Recharts | Risk trends, antibiogram, monitoring charts |
| Routing | React Router | Staff and doctor portal routes |
| API client | Axios | React to FastAPI calls |
| Backend | FastAPI | API layer and ML serving |
| Validation | Pydantic | Patient and clinical feature validation |
| ORM | SQLAlchemy | Database operations |
| Database | PostgreSQL | Patient records, encounters, predictions, outcomes |
| Hackathon database fallback | SQLite | Use if PostgreSQL setup causes delays |
| ML / AutoML | PyCaret | Compare, select, and tune AMR prediction models |
| ML foundation | scikit-learn | Models and preprocessing underneath PyCaret |
| Explainability | SHAP | Patient-level risk explanation |
| Data processing | Pandas + NumPy | Training and feature transformation |
| Model storage | PyCaret `save_model()` / pickle | Store the champion model |
| Authentication | JWT + FastAPI auth | Doctor and staff role simulation |
| Password hashing | bcrypt / passlib | Seeded login accounts |
| Frontend deployment | Vercel | React deployment |
| Backend deployment | Render / Railway | FastAPI deployment |
| Version control | GitHub | Four-member parallel development |

## Current implementation scope

The React frontend is integrated with the FastAPI backend. The prototype uses signed bearer sessions, PBKDF2-hashed seeded demo credentials, de-identified clinical CSV source records, persisted assessments and clinician feedback, live dashboard aggregation, and source-derived hospital intelligence. Generated patient records are disabled. The existing PyCaret model remains the preferred inference engine; the API uses its deterministic clinical-rules engine when the optional PyCaret runtime cannot be loaded.
