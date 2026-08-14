"""
pipeline/explainer.py
----------------------
SHAP-based explainability for the AMR model.

Provides:
  1. Global summary plot (feature importance across all test samples)
  2. Individual patient waterfall plot (why this patient?)
  3. Top-N feature contributors per prediction (for API response)

Uses shap.TreeExplainer for XGBoost/RF/LightGBM (exact, efficient).
Falls back to shap.LinearExplainer for logistic regression.
"""

import os
# Prevent SHAP from importing torch (avoids DLL crash on Windows
# when PyTorch was not cleanly installed)
os.environ.setdefault("SHAP_NO_TORCH", "1")

import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")   # non-interactive backend for server use
import matplotlib.pyplot as plt
from pathlib import Path
from typing import Any, Optional

warnings.filterwarnings("ignore")

from pipeline.config import REPORTS_DIR, TARGET_COL
from pipeline.utils import get_logger

logger = get_logger(__name__)


class Explainer:
    """SHAP explainability for the selected AMR model."""

    def __init__(self) -> None:
        self.explainer: Optional[Any]   = None
        self.shap_values: Optional[Any] = None
        self.feature_names: list[str]   = []
        self.X_test_transformed: Optional[pd.DataFrame] = None

    # -------------------------------------------------------------
    # Setup
    # -------------------------------------------------------------

    def _extract_pipeline_components(
        self, pycaret_model: Any, exp: Any
    ) -> tuple[Any, pd.DataFrame]:
        """
        Extract the underlying estimator and transformed test features
        from the PyCaret pipeline.
        """
        import shap

        # Get held-out test features from PyCaret experiment
        X_test = exp.X_test_transformed
        self.X_test_transformed = X_test

        # Extract the final estimator from the sklearn Pipeline
        # PyCaret wraps model: pipeline.steps[-1] = ('actual_estimator', model)
        if hasattr(pycaret_model, "steps"):
            raw_model = pycaret_model.steps[-1][1]
        elif hasattr(pycaret_model, "estimator"):
            raw_model = pycaret_model.estimator   # CalibratedClassifierCV
            if hasattr(raw_model, "estimator"):
                raw_model = raw_model.estimator
        else:
            raw_model = pycaret_model

        return raw_model, X_test

    def build_explainer(self, pycaret_model: Any, exp: Any) -> None:
        """
        Build the SHAP explainer appropriate for the model type.
        """
        import shap

        logger.info("Building SHAP explainer...")
        raw_model, X_test = self._extract_pipeline_components(pycaret_model, exp)

        model_name = type(raw_model).__name__.lower()
        logger.info(f"  Underlying model: {type(raw_model).__name__}")

        try:
            if any(k in model_name for k in ["xgb", "lgbm", "lightgbm",
                                              "forest", "tree", "catboost"]):
                self.explainer  = shap.TreeExplainer(raw_model)
                self.shap_values = self.explainer(X_test)
            elif "linear" in model_name or "logistic" in model_name:
                self.explainer   = shap.LinearExplainer(raw_model, X_test)
                self.shap_values = self.explainer(X_test)
            else:
                # Kernel SHAP: model-agnostic but slow -> use sample
                sample = shap.sample(X_test, min(100, len(X_test)))
                self.explainer   = shap.KernelExplainer(raw_model.predict_proba, sample)
                self.shap_values = self.explainer(X_test[:200])
        except Exception as e:
            logger.warning(f"  SHAP explainer build failed: {e}")
            return

        self.feature_names = list(X_test.columns)
        logger.info(f"  SHAP explainer built [OK] ({len(self.feature_names)} features)")

    # -------------------------------------------------------------
    # Global summary plot
    # -------------------------------------------------------------

    def plot_summary(self, max_display: int = 20) -> None:
        """
        SHAP summary plot - global feature importance across test set.
        Saved to reports/shap_summary.png.
        """
        if self.shap_values is None:
            logger.warning("SHAP values not computed. Call build_explainer() first.")
            return

        import shap
        fig, ax = plt.subplots(figsize=(10, 8))
        try:
            # For binary classification, use class=1 (AMR-positive) SHAP values
            sv = self.shap_values[..., 1] if len(self.shap_values.shape) == 3 else self.shap_values
            shap.summary_plot(
                sv,
                self.X_test_transformed,
                feature_names = self.feature_names,
                max_display   = max_display,
                show          = False,
            )
            path = REPORTS_DIR / "shap_summary.png"
            plt.tight_layout()
            plt.savefig(str(path), dpi=150, bbox_inches="tight")
            plt.close("all")
            logger.info(f"  SHAP summary plot saved -> {path}")
        except Exception as e:
            logger.warning(f"  SHAP summary plot failed: {e}")
            plt.close("all")

    def plot_bar(self, max_display: int = 20) -> None:
        """SHAP bar chart of mean absolute impact."""
        if self.shap_values is None:
            return

        import shap
        try:
            sv = self.shap_values[..., 1] if len(self.shap_values.shape) == 3 else self.shap_values
            shap.summary_plot(
                sv, self.X_test_transformed,
                plot_type="bar", max_display=max_display, show=False
            )
            path = REPORTS_DIR / "shap_bar.png"
            plt.tight_layout()
            plt.savefig(str(path), dpi=150, bbox_inches="tight")
            plt.close("all")
            logger.info(f"  SHAP bar chart saved -> {path}")
        except Exception as e:
            logger.warning(f"  SHAP bar chart failed: {e}")
            plt.close("all")

    # -------------------------------------------------------------
    # Individual patient explanation
    # -------------------------------------------------------------

    def explain_patient(
        self, patient_row: pd.DataFrame, pycaret_model: Any, exp: Any, top_n: int = 5
    ) -> list[dict]:
        """
        Return the top-N SHAP contributors for a single patient prediction.

        Returns a list of dicts:
          [{"feature": "previous_amr", "value": 1, "direction": "increases",
            "shap_contribution": 0.23}, ...]
        """
        import shap

        try:
            raw_model, _ = self._extract_pipeline_components(pycaret_model, exp)
            # Transform the patient row through PyCaret preprocessing pipeline
            if hasattr(pycaret_model, "steps"):
                transformer = pycaret_model[:-1]  # all steps except last estimator
                row_transformed = transformer.transform(patient_row)
            else:
                row_transformed = patient_row

            sv = self.explainer(row_transformed)
            # For binary classification pick class=1
            vals = sv.values[0] if len(sv.shape) == 2 else sv[..., 1].values[0]
            feature_names = list(row_transformed.columns)

            contributions = sorted(
                zip(feature_names, vals),
                key=lambda x: abs(x[1]),
                reverse=True,
            )[:top_n]

            results = []
            for feat, contrib in contributions:
                feat_val = (
                    row_transformed.iloc[0][feat]
                    if feat in row_transformed.columns
                    else None
                )
                results.append({
                    "feature":           feat,
                    "value":             feat_val,
                    "direction":         "increases" if contrib > 0 else "decreases",
                    "shap_contribution": round(float(contrib), 4),
                })
            return results

        except Exception as e:
            logger.warning(f"Individual patient SHAP explanation failed: {e}")
            return []

    # -------------------------------------------------------------
    # Top global features (for API model-info)
    # -------------------------------------------------------------

    def get_global_top_features(self, top_n: int = 10) -> list[dict]:
        """Return top-N features by mean |SHAP| across test set."""
        if self.shap_values is None:
            return []

        try:
            sv = self.shap_values[..., 1] if len(self.shap_values.shape) == 3 else self.shap_values
            mean_abs = np.abs(sv.values).mean(axis=0)
            sorted_idx = np.argsort(mean_abs)[::-1][:top_n]
            return [
                {
                    "feature": self.feature_names[i],
                    "mean_abs_shap": round(float(mean_abs[i]), 4),
                }
                for i in sorted_idx
            ]
        except Exception:
            return []

    # -------------------------------------------------------------
    # Run full explainability pipeline
    # -------------------------------------------------------------

    def explain_all(self, pycaret_model: Any, exp: Any) -> None:
        """Build explainer and save all global plots."""
        self.build_explainer(pycaret_model, exp)
        self.plot_summary()
        self.plot_bar()

        top = self.get_global_top_features(10)
        logger.info(f"\nTop 10 Global AMR Risk Factors:\n" +
                    "\n".join(f"  {r['feature']}: {r['mean_abs_shap']}" for r in top))
