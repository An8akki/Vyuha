"""
api/main.py
------------
FastAPI application for the AMR Decision Support System.

Endpoints:
  POST /predict          -> AMR risk prediction for a patient
  GET  /health           -> Service health check
  GET  /model-info       -> Model type, metrics, training metadata
  GET  /docs             -> Swagger UI (auto-generated)
  GET  /redoc            -> ReDoc UI (auto-generated)

The model is loaded once at startup using the FastAPI lifespan context.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
import time

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os

from api.schemas import PatientInput, PredictionResponse, ModelInfo, HealthResponse
from api.predictor import predictor
from api.routers import timeline, feedback, monitoring, outbreak, frontend_adapter
from pipeline.config import API_HOST, API_PORT
from pipeline.utils import get_logger

logger = get_logger(__name__)


# -----------------------------------------------------------------
# Lifespan - model loads at startup, cleans up at shutdown
# -----------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Load the AMR model on startup."""
    logger.info("AMR API starting - loading model...")
    try:
        predictor.load()
        if predictor.is_loaded:
            logger.info("Model loaded [OK] - API ready")
        else:
            logger.warning("Model not loaded - /predict will return 503")
    except Exception as e:
        logger.error(f"Model load error: {e}")
    yield
    logger.info("AMR API shutting down")


# -----------------------------------------------------------------
# App
# -----------------------------------------------------------------

app = FastAPI(
    title       = "AMR Decision Support API",
    description = (
        "Predicts the probability of an antimicrobial-resistant organism based on "
        "patient demographics, vitals, laboratory results, and clinical history. "
        "Outputs a calibrated AMR probability, risk tier (LOW/MODERATE/HIGH), "
        "and SHAP-based explainability for clinical decision support. "
        "\n\n**Disclaimer**: This tool supports clinical decision-making and does NOT "
        "autonomously recommend or prescribe antibiotics. All outputs must be "
        "interpreted alongside culture/AST results, local antibiograms, and "
        "clinical judgment."
    ),
    version     = "1.0.0",
    lifespan    = lifespan,
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# CORS - allow your UI team's frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# -----------------------------------------------------------------
# Register CDSS Routers
# -----------------------------------------------------------------
app.include_router(timeline.router)
app.include_router(feedback.router)
app.include_router(monitoring.router)
app.include_router(outbreak.router)
app.include_router(frontend_adapter.router)

# -----------------------------------------------------------------
# Serve Frontend (SPA)
# -----------------------------------------------------------------
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")
    
    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Allow API routes to 404 naturally if not found
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("redoc") or full_path.startswith("predict"):
            raise HTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(STATIC_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

# -----------------------------------------------------------------
# Exception handler
# -----------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(
        status_code = 500,
        content     = {"detail": f"Internal server error: {str(exc)}"},
    )


# -----------------------------------------------------------------
# Routes
# -----------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """
    Service health check.
    Returns model load status and API version.
    """
    return HealthResponse(
        status       = "ok" if predictor.is_loaded else "degraded",
        model_loaded = predictor.is_loaded,
        version      = "1.0.0",
    )


@app.get("/model-info", response_model=ModelInfo, tags=["Model"])
async def get_model_info() -> ModelInfo:
    """
    Return metadata about the currently loaded AMR model:
    model type, test-set metrics, training date, and top risk features.
    """
    if not predictor.is_loaded:
        raise HTTPException(
            status_code = 503,
            detail      = "Model not loaded. Train the pipeline first.",
        )
    return predictor.get_model_info()


@app.post(
    "/predict",
    response_model  = PredictionResponse,
    tags            = ["Prediction"],
    summary         = "Predict AMR risk for a patient",
    response_description = "AMR probability, risk tier, SHAP explanations, and clinical guidance",
)
async def predict(patient: PatientInput) -> PredictionResponse:
    """
    ## AMR Risk Prediction

    Submit patient clinical data and receive:

    - **resistance_probability**: Calibrated probability of an AMR organism (0–1)
    - **risk_tier**: `LOW` / `MODERATE` / `HIGH`
    - **recommended_action**: Clinical guidance string
    - **top_features**: Top SHAP-based feature contributions explaining this prediction

    ### Threshold Guide (prototype - validate from calibration curves):
    | Probability | Tier     | Guidance |
    |-------------|----------|----------|
    | < 0.30      | LOW      | Standard empiric coverage likely adequate |
    | 0.30 – 0.70 | MODERATE | Consider broadened coverage |
    | > 0.70      | HIGH     | High AMR risk - escalate therapy |

    ### Important
    This system predicts AMR **risk** and explains contributing factors.
    It does NOT recommend specific antibiotics. Culture/AST results,
    local antibiograms, allergies, renal function, and clinician judgment
    must govern actual antimicrobial selection.
    """
    if not predictor.is_loaded:
        raise HTTPException(
            status_code = 503,
            detail      = "Model not loaded. Run run_pipeline.py to train first.",
        )

    try:
        result = predictor.predict(patient)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"/predict error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    return result


@app.post(
    "/predict/batch",
    response_model  = list[PredictionResponse],
    tags            = ["Prediction"],
    summary         = "Batch AMR risk prediction",
)
async def predict_batch(patients: list[PatientInput]) -> list[PredictionResponse]:
    """
    Predict AMR risk for multiple patients in one request.
    Maximum 100 patients per batch.
    """
    if not predictor.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    if len(patients) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 patients per batch.")

    results = []
    for patient in patients:
        try:
            results.append(predictor.predict(patient))
        except Exception as e:
            logger.warning(f"Batch prediction failed for one patient: {e}")
            results.append(
                PredictionResponse(
                    resistance_probability = -1.0,
                    risk_tier              = "ERROR",
                    risk_color             = "grey",
                    recommended_action     = f"Prediction error: {e}",
                    top_features           = [],
                )
            )
    return results


# -----------------------------------------------------------------
# Entry point (for direct run: python api/main.py)
# -----------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host     = API_HOST,
        port     = API_PORT,
        reload   = False,
        log_level= "info",
    )
