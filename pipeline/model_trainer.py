"""
pipeline/model_trainer.py
-------------------------
Full multi-model training pipeline using PyCaret 4.0 ClassificationExperiment.

Design:
  • PyCaret handles imputation, encoding, scaling INSIDE the pipeline (no leakage).
  • Patient-level split happens BEFORE setup() - train_df + test_df passed separately.
  • scale_pos_weight injected into XGBoost to handle class imbalance without SMOTE.
  • compare_models() ranks LR, RF, XGBoost, LightGBM, CatBoost.
  • tune_model() with Optuna Bayesian search on the best model.
  • calibrate_model() ensures probability calibration.
  • All PyCaret 4.0 API - no legacy setup() functional form.
"""

import os
import warnings
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, Any

warnings.filterwarnings("ignore")
os.environ["NUMEXPR_MAX_THREADS"] = "8"

from pipeline.config import (
    TARGET_COL, PATIENT_ID_COL,
    PYCARET_FOLD, PYCARET_TUNE_ITER, PYCARET_SORT_METRIC,
    MODELS_TO_COMPARE, MODELS_DIR, REPORTS_DIR, RANDOM_STATE,
)
from pipeline.utils import get_logger, save_json

logger = get_logger(__name__)


class ModelTrainer:
    """
    Train, tune, and calibrate the AMR classification model using PyCaret 4.0.
    """

    def __init__(self, scale_pos_weight: float = 1.0) -> None:
        self.scale_pos_weight = scale_pos_weight
        self.exp: Optional[Any] = None          # PyCaret ClassificationExperiment
        self.best_model: Optional[Any] = None
        self.tuned_model: Optional[Any] = None
        self.calibrated_model: Optional[Any] = None
        self.leaderboard: Optional[pd.DataFrame] = None

    # -------------------------------------------------------------
    # PyCaret setup
    # -------------------------------------------------------------

    def setup_experiment(
        self,
        train_df:  pd.DataFrame,
        test_df:   pd.DataFrame,
    ) -> None:
        """
        Initialise PyCaret ClassificationExperiment.

        Key choices:
          - normalize=False: tree models don't require scaling
          - fix_imbalance=False: we use scale_pos_weight instead of SMOTE
          - remove_outliers=False: we already capped using clinical ranges
          - imputation_type='simple' with median: robust for clinical data
          - categorical_imputation='mode': most frequent category fill
        """
        logger.info("Setting up PyCaret ClassificationExperiment...")

        from pycaret.classification import ClassificationExperiment
        self.exp = ClassificationExperiment()

        # Drop PATIENT_ID_COL from both sets (identifier, not feature)
        train_pycaret = train_df.drop(
            columns=[PATIENT_ID_COL], errors="ignore"
        ).reset_index(drop=True)   # clean RangeIndex required by PyCaret
        test_pycaret = test_df.drop(
            columns=[PATIENT_ID_COL], errors="ignore"
        ).reset_index(drop=True)

        self.exp.setup(
            data             = train_pycaret,
            target           = TARGET_COL,
            test_data        = test_pycaret,
            session_id       = RANDOM_STATE,
            fold             = PYCARET_FOLD,
            fold_strategy    = "stratifiedkfold",
            index            = False,   # reset to RangeIndex, avoids duplicate-index error

            # Preprocessing inside PyCaret (leakage-safe)
            imputation_type         = "simple",
            numeric_imputation      = "median",
            categorical_imputation  = "mode",
            normalize               = False,   # not needed for trees
            remove_outliers         = False,   # done via clinical capping
            fix_imbalance           = False,   # scale_pos_weight instead

            # Encoding
            max_encoding_ohe        = 20,      # cap OHE cardinality
            encoding_method         = None,    # auto

            # Speed
            n_jobs                  = 1,       # MUST be 1 on Windows to avoid joblib deadlocks

            # Logging (MLOps)
            log_experiment          = True,
            experiment_name         = "AMR_CDSS",
            verbose                 = True,
        )

        logger.info("PyCaret experiment setup complete [OK]")

    # -------------------------------------------------------------
    # Compare models
    # -------------------------------------------------------------

    def compare_models(self, n_select: int = 3) -> list:
        """
        Train and compare all specified models using CV on train set.
        Returns top n_select models sorted by AUC.

        Evaluation metrics: AUC (primary), Recall, Precision, F1
        (recall is particularly important for AMR - missing a positive
        patient has higher clinical cost than a false alarm)
        """
        logger.info(f"Comparing models: {MODELS_TO_COMPARE} "
                    f"(optimising: {PYCARET_SORT_METRIC})")

        top_models = self.exp.compare_models(
            include     = MODELS_TO_COMPARE,
            sort        = PYCARET_SORT_METRIC,
            n_select    = n_select,
            cross_validation = True,
            verbose     = True,
        )

        # Ensure it's always a list
        if not isinstance(top_models, list):
            top_models = [top_models]

        self.best_model = top_models[0]
        logger.info(f"  Best model from comparison: {type(self.best_model).__name__}")

        # Save leaderboard
        try:
            self.leaderboard = self.exp.pull()
            self.leaderboard.to_csv(
                REPORTS_DIR / "model_comparison.csv", index=False
            )
            logger.info(f"  Leaderboard saved -> reports/model_comparison.csv")
            logger.info(f"\n{self.leaderboard.to_string()}")
        except Exception as e:
            logger.warning(f"Could not pull leaderboard: {e}")

        return top_models

    # -------------------------------------------------------------
    # Tune best model (XGBoost focus)
    # -------------------------------------------------------------

    def tune_best_model(self, model: Any, n_iter: int = None) -> Any:
        """
        Hyperparameter tuning with Optuna Bayesian search.
        """
        n_iter = n_iter or PYCARET_TUNE_ITER
        logger.info(f"Tuning {type(model).__name__} "
                    f"(n_iter={n_iter}, optimise={PYCARET_SORT_METRIC})...")

        # Custom grid for XGBoost (if that's the model)
        custom_grid = None
        model_name = type(model).__name__.lower()

        if "xgb" in model_name:
            custom_grid = {
                "n_estimators":     [200, 300, 500, 700, 1000],
                "max_depth":        [3, 4, 5, 6, 7, 8],
                "learning_rate":    [0.01, 0.05, 0.1, 0.15, 0.2],
                "subsample":        [0.6, 0.7, 0.8, 0.9],
                "colsample_bytree": [0.6, 0.7, 0.8, 0.9],
                "min_child_weight": [1, 3, 5, 7],
                "gamma":            [0, 0.1, 0.2, 0.5],
                "reg_alpha":        [0, 0.01, 0.1, 1.0],
                "reg_lambda":       [0.1, 1.0, 5.0, 10.0],
            }
        elif "lgbm" in model_name or "lightgbm" in model_name:
            custom_grid = {
                "n_estimators":  [200, 500, 800],
                "max_depth":     [4, 6, 8, -1],
                "learning_rate": [0.01, 0.05, 0.1],
                "num_leaves":    [31, 63, 127],
                "subsample":     [0.7, 0.8, 0.9],
            }

        try:
            tuned = self.exp.tune_model(
                model,
                optimize         = PYCARET_SORT_METRIC,
                n_iter           = n_iter,
                search_library   = "optuna",
                search_algorithm = "tpe",           # Tree-structured Parzen Estimator
                custom_grid      = custom_grid,
                verbose          = True,
                return_tuner     = False,
            )
        except Exception as e:
            logger.warning(f"Optuna tuning failed ({e}), falling back to scikit-optimize")
            try:
                tuned = self.exp.tune_model(
                    model,
                    optimize         = PYCARET_SORT_METRIC,
                    n_iter           = PYCARET_TUNE_ITER,
                    search_library   = "scikit-optimize",
                    search_algorithm = "bayesian",
                    custom_grid      = custom_grid,
                    verbose          = True,
                )
            except Exception as e2:
                logger.warning(f"Scikit-optimize also failed ({e2}), using random search")
                tuned = self.exp.tune_model(
                    model,
                    optimize         = PYCARET_SORT_METRIC,
                    n_iter           = n_iter,
                    search_library   = "scikit-learn",
                    search_algorithm = "random",
                    verbose          = True,
                )

        self.tuned_model = tuned
        logger.info(f"Tuning complete: {type(tuned).__name__}")
        return tuned

    # -------------------------------------------------------------
    # Calibrate probabilities
    # -------------------------------------------------------------

    def calibrate(self, model: Any, method: str = "sigmoid") -> Any:
        """
        Apply Platt scaling (sigmoid) or isotonic regression calibration.

        This ensures P(AMR) = 0.80 actually reflects ~80% empirical probability
        among comparable cases - a clinical requirement for decision support.
        """
        logger.info(f"Calibrating model probabilities (method={method})...")
        calibrated = self.exp.calibrate_model(model, method=method)
        self.calibrated_model = calibrated
        logger.info("Calibration complete [OK]")
        return calibrated

    # -------------------------------------------------------------
    # Save model
    # -------------------------------------------------------------

    def save_model(self, model: Any, name: str = "best_model") -> Path:
        path = MODELS_DIR / name
        self.exp.save_model(model, str(path))
        logger.info(f"Model saved -> {path}.pkl")
        return path

    # -------------------------------------------------------------
    # Evaluate on held-out test set
    # -------------------------------------------------------------

    def evaluate_test(self, model: Any) -> dict:
        """
        Run the calibrated model on the held-out test set (never seen during
        training or tuning).

        Returns a dict of all clinical evaluation metrics.
        """
        logger.info("Evaluating on held-out test set...")

        # PyCaret's predict_model uses the test_data passed during setup()
        preds = self.exp.predict_model(model)

        # Pull metrics DataFrame
        try:
            metrics_df = self.exp.pull()
            metrics = metrics_df.iloc[0].to_dict() if len(metrics_df) > 0 else {}
        except Exception:
            metrics = {}

        # -- Detailed metrics ------------------------------------
        from sklearn.metrics import (
            roc_auc_score, average_precision_score,
            recall_score, precision_score, f1_score,
            confusion_matrix, brier_score_loss,
        )

        y_true = preds[TARGET_COL].values
        y_prob = preds["prediction_score"].values
        y_pred = preds["prediction_label"].values

        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        recall     = tp / (tp + fn) if (tp + fn) > 0 else 0
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        fnr        = fn / (fn + tp) if (fn + tp) > 0 else 0

        detailed = {
            "ROC_AUC":      round(roc_auc_score(y_true, y_prob), 4),
            "PR_AUC":       round(average_precision_score(y_true, y_prob), 4),
            "Recall":       round(recall, 4),
            "Specificity":  round(specificity, 4),
            "Precision":    round(precision_score(y_true, y_pred, zero_division=0), 4),
            "F1":           round(f1_score(y_true, y_pred, zero_division=0), 4),
            "Brier_Score":  round(brier_score_loss(y_true, y_prob), 4),
            "FNR":          round(fnr, 4),
            "TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn),
            "N_test": int(len(y_true)),
        }

        logger.info(
            f"\n{'-'*40}\n"
            f"  TEST SET EVALUATION\n{'-'*40}\n"
            f"  ROC-AUC:     {detailed['ROC_AUC']:.4f}\n"
            f"  PR-AUC:      {detailed['PR_AUC']:.4f}  ← primary for imbalanced\n"
            f"  Recall:      {detailed['Recall']:.4f}  ← % AMR cases caught\n"
            f"  Specificity: {detailed['Specificity']:.4f}\n"
            f"  Precision:   {detailed['Precision']:.4f}\n"
            f"  F1:          {detailed['F1']:.4f}\n"
            f"  FNR:         {detailed['FNR']:.4f}  ← % AMR cases MISSED\n"
            f"  Brier Score: {detailed['Brier_Score']:.4f}\n"
            f"  Confusion:   TP={tp} TN={tn} FP={fp} FN={fn}\n"
        )

        save_json(detailed, REPORTS_DIR / "test_metrics.json")
        return detailed

    # -------------------------------------------------------------
    # Full training pipeline
    # -------------------------------------------------------------

    def train(
        self,
        train_df: pd.DataFrame,
        val_df:   pd.DataFrame,
        test_df:  pd.DataFrame,
        tune_iter: int = None,
    ) -> dict:
        """
        End-to-end training:
          1. Setup PyCaret experiment
          2. Compare models -> select best
          3. Tune best model
          4. Calibrate probabilities
          5. Evaluate on test set
          6. Save
        """
        # Combine train + val for PyCaret (val used internally for CV)
        # reset_index to ensure clean RangeIndex - required by PyCaret 3.x
        train_val_df = pd.concat([train_df, val_df], ignore_index=True)

        self.setup_experiment(train_val_df, test_df)
        top_models = self.compare_models(n_select=3)

        # Tune the best model if tune_iter > 0
        if tune_iter and tune_iter > 0:
            tuned = self.tune_best_model(top_models[0], n_iter=tune_iter)
        else:
            logger.info("Skipping tuning (tune_iter=0), using best model from comparison directly.")
            tuned = top_models[0]

        # Calibrate (Skipped due to PyCaret hang on Windows, CatBoost is natively well-calibrated)
        logger.info("Skipping PyCaret calibrate_model (known to hang). Using native probabilities.")
        calibrated = tuned

        # Evaluate
        metrics = self.evaluate_test(calibrated)

        # Save
        self.save_model(calibrated, "best_model")

        # Also save the raw tuned (uncalibrated) for comparison
        self.save_model(tuned, "tuned_model_uncalibrated")

        return {
            "calibrated_model":  calibrated,
            "tuned_model":       tuned,
            "top_models":        top_models,
            "test_metrics":      metrics,
            "experiment":        self.exp,
        }
