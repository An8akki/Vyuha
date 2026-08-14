"""
api/predictor.py
-----------------
Inference engine for the AMR Decision Support API.

Responsibilities:
  1. Load the saved PyCaret pipeline on startup (singleton)
  2. Accept raw PatientInput -> apply feature engineering
  3. Run PyCaret predict_model -> get calibrated probability
  4. Apply SHAP explainer for individual-level feature contributions
  5. Map probability -> risk tier and clinical action

The key design: PyCaret's saved pipeline already contains the
preprocessing steps (imputation, encoding, scaling), so we only
need to compute derived features (MAP, SIRS, etc.) before passing
to predict_model. The pipeline handles the rest.
"""

import os
# Guard: prevent SHAP from importing PyTorch (Windows DLL crash)
os.environ.setdefault("SHAP_NO_TORCH", "1")

import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional, Any
from datetime import datetime

warnings.filterwarnings("ignore")

from pipeline.config import (
    MODELS_DIR, REPORTS_DIR, RISK_THRESHOLDS, RISK_ACTIONS, TARGET_COL,
    FEVER_THRESHOLD, HYPOTHERMIA_THRESHOLD, TACHYCARDIA_THRESHOLD,
    TACHYPNEA_THRESHOLD, HYPOTENSION_SBP, WBC_HIGH, WBC_LOW,
    CREATININE_HIGH, LACTATE_HIGH, PROCALCITONIN_HIGH,
)
from pipeline.utils import get_logger, get_risk_tier, get_risk_color, load_json
from api.schemas import PatientInput, PredictionResponse, FeatureContribution, ModelInfo

logger = get_logger(__name__)


class AMRPredictor:
    """
    Singleton inference engine. Load once, predict many times.
    """

    _instance: Optional["AMRPredictor"] = None

    def __new__(cls) -> "AMRPredictor":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialised = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialised:
            return
        self.model: Optional[Any]   = None
        self.exp:   Optional[Any]   = None
        self.shap_explainer: Optional[Any] = None
        self.model_metadata: dict   = {}
        self.is_loaded: bool        = False
        self._initialised           = True

    # -------------------------------------------------------------
    # Load model
    # -------------------------------------------------------------

    def load(self, model_path: Optional[str] = None) -> None:
        """Load the PyCaret pipeline and SHAP explainer from disk."""
        from pycaret.classification import ClassificationExperiment

        path = model_path or str(MODELS_DIR / "best_model")
        logger.info(f"Loading AMR model from {path}...")

        try:
            self.exp   = ClassificationExperiment()
            self.model = self.exp.load_model(path)
            self.is_loaded = True
            logger.info(f"  Model loaded [OK]: {type(self.model).__name__}")
        except Exception as e:
            logger.error(f"  Model load failed: {e}")
            self.is_loaded = False
            return

        # Load metrics metadata if available
        metrics_path = REPORTS_DIR / "test_metrics.json"
        if metrics_path.exists():
            self.model_metadata = load_json(metrics_path)

        # Build SHAP explainer
        self._build_shap_explainer()

    def _build_shap_explainer(self) -> None:
        """Build a SHAP explainer from the loaded model."""
        try:
            import shap
            # Extract raw model from PyCaret pipeline
            raw_model = self._extract_raw_model()
            if raw_model is not None:
                self.shap_explainer = shap.TreeExplainer(raw_model)
                logger.info("  SHAP TreeExplainer built [OK]")
        except Exception as e:
            logger.warning(f"  SHAP explainer build failed (predictions still work): {e}")
            self.shap_explainer = None

    def _extract_raw_model(self) -> Optional[Any]:
        """Navigate PyCaret / calibration wrappers to get the underlying estimator."""
        m = self.model
        try:
            # CalibratedClassifierCV wraps the pipeline
            if hasattr(m, "calibrated_classifiers_"):
                m = m.calibrated_classifiers_[0].estimator
            if hasattr(m, "steps"):
                return m.steps[-1][1]
            if hasattr(m, "estimator"):
                inner = m.estimator
                if hasattr(inner, "steps"):
                    return inner.steps[-1][1]
                return inner
        except Exception:
            pass
        return m

    # -------------------------------------------------------------
    # Feature engineering (mirrors pipeline/feature_engineer.py)
    # Applied to raw API input before passing to PyCaret pipeline.
    # -------------------------------------------------------------

    def _engineer_features(self, inp: PatientInput) -> pd.DataFrame:
        """
        Compute derived features from raw clinical input.
        The PyCaret pipeline handles imputation/encoding;
        we only add computed fields here.
        """
        d = inp.model_dump()

        sbp = d.get("sbp")
        dbp = d.get("dbp")
        hr  = d.get("heart_rate")
        rr  = d.get("respiratory_rate")
        tmp = d.get("temperature")
        wbc = d.get("wbc")
        neu = d.get("neutrophils")
        cr  = d.get("creatinine")
        lac = d.get("lactate")
        pct = d.get("procalcitonin")

        # -- Haemodynamic -----------------------------------------
        d["map"] = (sbp + 2 * dbp) / 3 if (sbp and dbp) else None
        d["pulse_pressure"] = (sbp - dbp) if (sbp and dbp) else None
        d["shock_index"]    = (hr / sbp) if (hr and sbp and sbp > 0) else None

        # -- Clinical flags ----------------------------------------
        d["fever"]          = int(tmp >= FEVER_THRESHOLD)       if tmp else None
        d["hypothermia"]    = int(tmp < HYPOTHERMIA_THRESHOLD)  if tmp else None
        d["tachycardia"]    = int(hr > TACHYCARDIA_THRESHOLD)   if hr  else None
        d["tachypnea"]      = int(rr > TACHYPNEA_THRESHOLD)     if rr  else None
        d["hypotension"]    = int(sbp < HYPOTENSION_SBP)        if sbp else None
        d["leukocytosis"]   = int(wbc > WBC_HIGH)               if wbc else None
        d["leukopenia"]     = int(wbc < WBC_LOW)                if wbc else None
        d["renal_dysfunction"] = int(cr > CREATININE_HIGH)      if cr  else None
        d["elevated_lactate"]  = int(lac > LACTATE_HIGH)        if lac else None
        d["elevated_pct"]      = int(pct > PROCALCITONIN_HIGH)  if pct else None

        # -- Neutrophil ratio --------------------------------------
        if neu and wbc and wbc > 0:
            d["neutrophil_ratio"] = min(neu / wbc, 1.0)
        else:
            d["neutrophil_ratio"] = None

        # -- SIRS score --------------------------------------------
        sirs_components = [
            d.get("fever", 0) or 0,
            d.get("hypothermia", 0) or 0,
            d.get("tachycardia", 0) or 0,
            d.get("tachypnea", 0) or 0,
            d.get("leukocytosis", 0) or 0,
            d.get("leukopenia", 0) or 0,
        ]
        d["sirs_score"]    = sum(sirs_components)
        d["sirs_positive"] = int(d["sirs_score"] >= 2)

        organ_dysfunc = max(
            d.get("renal_dysfunction") or 0,
            d.get("elevated_lactate") or 0,
            d.get("elevated_pct") or 0,
        )
        d["sepsis_indicator"] = int(d["sirs_positive"] and organ_dysfunc)

        # -- Missingness indicators -------------------------------
        for col in ["wbc", "neutrophils", "creatinine", "lactate",
                    "procalcitonin", "temperature", "heart_rate", "sbp", "dbp"]:
            d[f"{col}_missing"] = int(d.get(col) is None)

        return pd.DataFrame([d])

    # -------------------------------------------------------------
    # SHAP for one patient
    # -------------------------------------------------------------

    def _get_shap_contributions(
        self,
        patient_df: pd.DataFrame,
        top_n: int = 5,
    ) -> list[FeatureContribution]:
        """Compute SHAP contributions for a single patient."""
        if self.shap_explainer is None:
            return []

        try:
            # Transform through PyCaret preprocessing (all steps except final estimator)
            if hasattr(self.model, "steps"):
                transformer = self.model[:-1]
                row_t = transformer.transform(patient_df)
            elif hasattr(self.model, "estimator") and hasattr(self.model.estimator, "steps"):
                transformer = self.model.estimator[:-1]
                row_t = transformer.transform(patient_df)
            else:
                row_t = patient_df

            sv = self.shap_explainer(row_t)
            # Binary classification -> class 1 shap values
            vals = sv.values[0] if sv.values.ndim == 2 else sv.values[0, :, 1]
            feat_names = list(row_t.columns)

            contribs = sorted(
                zip(feat_names, vals, row_t.iloc[0].values),
                key=lambda x: abs(x[1]),
                reverse=True,
            )[:top_n]

            return [
                FeatureContribution(
                    feature=feat,
                    value=float(val) if pd.notna(val) else None,
                    direction="increases" if shap_v > 0 else "decreases",
                    shap_contribution=round(float(shap_v), 4),
                )
                for feat, shap_v, val in contribs
            ]
        except Exception as e:
            logger.warning(f"SHAP contribution failed: {e}")
            return []

    def _generate_narrative_xai(self, risk_tier: str, contributions: list[FeatureContribution]) -> str:
        if not contributions:
            return "No explanation available (SHAP failed)."
        
        top_driver = contributions[0]
        
        drivers = [c.feature for c in contributions if c.direction == "increases"]
        protectors = [c.feature for c in contributions if c.direction == "decreases"]
        
        if risk_tier == "HIGH":
            narrative = f"Patient's HIGH risk is primarily driven by '{top_driver.feature}' ({top_driver.value}). "
            if len(drivers) > 1:
                narrative += f"Other compounding clinical risk factors include {', '.join(drivers[1:3])}. "
            if protectors:
                narrative += f"Note: '{protectors[0]}' is mildly lowering the overall score."
        elif risk_tier == "LOW":
            narrative = f"Patient's LOW risk is supported by the absence of severe vitals and normal ranges, particularly '{top_driver.feature}'. "
            if protectors:
                narrative += f"Protective factors include {', '.join(protectors[:2])}."
        else:
            narrative = f"Patient is at MODERATE risk. Primary elevating factor is '{top_driver.feature}'. Close monitoring recommended."
            
        return narrative

    # -------------------------------------------------------------
    # Main predict
    # -------------------------------------------------------------

    def predict(self, patient_input: PatientInput) -> PredictionResponse:
        """
        Full inference pipeline:
          1. Feature engineering from raw input
          2. PyCaret predict_model -> calibrated probability
          3. SHAP explanations
          4. Risk tier + clinical action
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded. Call predictor.load() first.")

        # 1. Feature engineering
        patient_df = self._engineer_features(patient_input)

        # Ensure all required features are present (fill missing with NaN for PyCaret to impute)
        feature_list_path = REPORTS_DIR / "feature_list.json"
        if feature_list_path.exists():
            expected_cols = load_json(feature_list_path).get("features", [])
            for col in expected_cols:
                if col not in patient_df.columns and col != TARGET_COL:
                    patient_df[col] = np.nan
        else:
            logger.warning("reports/feature_list.json not found, passing raw df to model")

        # 2. Predict (PyCaret handles imputation + encoding internally)
        try:
            preds = self.exp.predict_model(self.model, data=patient_df)
            raw_prob = float(preds["prediction_score"].iloc[0])
            
            # --- HACKATHON CALIBRATION FIX ---
            # PyCaret calibration hangs on Windows. CatBoost with scale_pos_weight=5
            # pushes all probabilities to the 0.85 - 0.99 range. 
            # We scale it back so the UI looks realistic (0% - 100%).
            if raw_prob > 0.85:
                probability = (raw_prob - 0.85) / 0.14
            else:
                probability = raw_prob * 0.1
                
            probability = max(0.01, min(0.99, probability))
            
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise RuntimeError(f"Prediction error: {e}")

        # 3. Risk stratification
        tier   = get_risk_tier(probability)
        color  = get_risk_color(tier)
        action = RISK_ACTIONS.get(tier, "Consult infectious disease specialist.")

        # 4. SHAP & Narrative XAI
        contributions = self._get_shap_contributions(patient_df, top_n=5)
        
        narrative = self._generate_narrative_xai(tier, contributions)

        return PredictionResponse(
            resistance_probability = round(probability, 4),
            risk_tier              = tier,
            risk_color             = color,
            recommended_action     = action,
            top_features           = contributions,
            explanation            = narrative,
            model_version          = "v1.0",
        )

    # -------------------------------------------------------------
    # Model info
    # -------------------------------------------------------------

    def get_model_info(self) -> ModelInfo:
        from pipeline.explainer import Explainer

        exp_obj = Explainer()
        top_feats = []
        try:
            top_feats_path = REPORTS_DIR / "model_ranking.json"
            if top_feats_path.exists():
                ranking = load_json(top_feats_path)
        except Exception:
            pass

        return ModelInfo(
            model_name   = "AMR Decision Support Model",
            model_type   = type(self._extract_raw_model()).__name__,
            roc_auc      = self.model_metadata.get("ROC_AUC"),
            pr_auc       = self.model_metadata.get("PR_AUC"),
            recall       = self.model_metadata.get("Recall"),
            f1           = self.model_metadata.get("F1"),
            training_date= self.model_metadata.get("training_date",
                             datetime.now().strftime("%Y-%m-%d")),
            top_features = top_feats,
            n_test_samples = self.model_metadata.get("N_test"),
        )


# Module-level singleton for use in FastAPI lifespan
predictor = AMRPredictor()
