"""
run_pipeline.py
---------------
Master script for the AMR Decision Support ML Pipeline.

Run this to:
  1. Load all ARMD CSV files
  2. Integrate into a unified patient-encounter table
  3. Engineer clinical features
  4. Patient-level train/val/test split
  5. Train, tune, and calibrate models with PyCaret
  6. Evaluate on held-out test set
  7. Run SHAP explainability
  8. Save all artifacts to models/ and reports/

After this script completes, start the API with:
  uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

Usage:
  python run_pipeline.py
  python run_pipeline.py --sample 100000  (smaller sample for quick test)
  python run_pipeline.py --tune-iter 10   (fewer tuning iterations)
"""

import argparse
import os
import sys
import time
import warnings
from datetime import datetime
from pathlib import Path

# Guard: prevent SHAP from importing PyTorch (Windows DLL crash)
os.environ.setdefault("SHAP_NO_TORCH", "1")

warnings.filterwarnings("ignore")

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from pipeline.config import (
    MODELS_DIR, REPORTS_DIR, COHORT_SAMPLE_ROWS, TARGET_COL,
)
from pipeline.data_loader    import DataLoader
from pipeline.data_integrator import DataIntegrator
from pipeline.feature_engineer import FeatureEngineer
from pipeline.preprocessor   import Preprocessor
from pipeline.model_trainer  import ModelTrainer
from pipeline.model_selector import ModelSelector
from pipeline.explainer      import Explainer
from pipeline.utils          import get_logger, save_json

logger = get_logger("AMR_PIPELINE")


# -----------------------------------------------------------------
# CLI args
# -----------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AMR ML Pipeline Runner")
    parser.add_argument(
        "--sample", type=int, default=COHORT_SAMPLE_ROWS,
        help=f"Number of cohort rows to sample (default: {COHORT_SAMPLE_ROWS:,})"
    )
    parser.add_argument(
        "--tune-iter", type=int, default=30,
        help="Number of hyperparameter tuning iterations (default: 30)"
    )
    parser.add_argument(
        "--skip-shap", action="store_true",
        help="Skip SHAP explainability (faster for quick runs)"
    )
    parser.add_argument(
        "--calibration-method", choices=["sigmoid", "isotonic"], default="sigmoid",
        help="Probability calibration method (default: sigmoid/Platt)"
    )
    return parser.parse_args()


# -----------------------------------------------------------------
# Pipeline stages
# -----------------------------------------------------------------

def stage_banner(name: str) -> None:
    logger.info(f"\n{'='*60}")
    logger.info(f"  STAGE: {name}")
    logger.info(f"{'='*60}")


def run(args: argparse.Namespace) -> dict:
    """
    Execute the full AMR ML pipeline end-to-end.
    Returns a summary dict with paths and metrics.
    """
    start_time = time.time()
    run_metadata: dict = {
        "run_timestamp": datetime.now().isoformat(),
        "sample_rows":   args.sample,
        "tune_iter":     args.tune_iter,
    }

    # -- Stage 1: Data Loading -------------------------------------
    stage_banner("1 / 7  DATA LOADING")
    loader = DataLoader()
    data = loader.load_all()

    # -- Stage 2: Data Integration ---------------------------------
    stage_banner("2 / 7  DATA INTEGRATION")
    integrator = DataIntegrator()
    unified    = integrator.integrate(data)

    logger.info(f"\nUnified table shape: {unified.shape}")
    logger.info(f"Columns: {list(unified.columns)}")
    logger.info(f"AMR+ rate: {unified[TARGET_COL].mean()*100:.1f}%")

    # -- Stage 3: Feature Engineering ------------------------------
    stage_banner("3 / 7  FEATURE ENGINEERING")
    engineer = FeatureEngineer()
    featured = engineer.engineer(unified)

    logger.info(f"Feature matrix: {featured.shape}")
    logger.info(f"Feature columns ({len(engineer.feature_columns)}):")
    for i, col in enumerate(engineer.feature_columns, 1):
        logger.info(f"  {i:2d}. {col}")

    # Save feature list for documentation
    save_json(
        {"features": engineer.feature_columns},
        REPORTS_DIR / "feature_list.json"
    )

    # -- Stage 4: Preprocessing & Split ----------------------------
    stage_banner("4 / 7  PREPROCESSING & PATIENT SPLIT")
    preprocessor = Preprocessor()
    train_df, val_df, test_df = preprocessor.patient_level_split(featured)
    spw = preprocessor.compute_class_weight(train_df)

    run_metadata["class_balance"] = preprocessor.class_counts
    run_metadata["split"] = {
        "train_rows": len(train_df),
        "val_rows":   len(val_df),
        "test_rows":  len(test_df),
    }

    # -- Stage 5: Model Training ------------------------------------
    stage_banner("5 / 7  MODEL TRAINING (PyCaret + MultiModel)")
    trainer = ModelTrainer(scale_pos_weight=spw)

    results = trainer.train(train_df, val_df, test_df, tune_iter=args.tune_iter)
    metrics = results["test_metrics"]

    run_metadata["test_metrics"] = metrics

    # -- Stage 6: Model Selection Decision Engine ------------------
    stage_banner("6 / 7  MODEL SELECTION")
    selector = ModelSelector()

    # For hackathon: we trained a single best model via PyCaret compare_models.
    # The selector evaluates that model's clinical metrics.
    model_candidates = [
        {
            "name":    type(results["calibrated_model"]).__name__,
            "model":   results["calibrated_model"],
            "metrics": metrics,
        }
    ]
    best_result = selector.select(model_candidates)

    run_metadata["selected_model"] = {
        "name":            selector.selected_model_name,
        "composite_score": selector.selection_report.get("composite_score"),
    }

    logger.info(
        f"\n✅ SELECTED MODEL: {selector.selected_model_name}\n"
        f"   ROC-AUC:  {metrics.get('ROC_AUC', 0):.4f}\n"
        f"   PR-AUC:   {metrics.get('PR_AUC', 0):.4f}\n"
        f"   Recall:   {metrics.get('Recall', 0):.4f}\n"
        f"   FNR:      {metrics.get('FNR', 0):.4f}"
    )

    # AUC gate: warn if below clinical utility threshold
    if metrics.get("ROC_AUC", 0) < 0.70:
        logger.warning(
            "⚠  ROC-AUC < 0.70. Model may have insufficient discrimination for "
            "clinical use. Consider more data, additional features, or re-checking "
            "label definition."
        )

    # -- Stage 7: SHAP Explainability ------------------------------
    if not args.skip_shap:
        stage_banner("7 / 7  SHAP EXPLAINABILITY")
        explainer = Explainer()
        try:
            explainer.explain_all(results["calibrated_model"], results["experiment"])
            top_features = explainer.get_global_top_features(10)
            run_metadata["top_global_features"] = top_features
            logger.info(f"SHAP analysis complete - plots saved to reports/")
        except Exception as e:
            logger.warning(f"SHAP stage failed: {e}. Continuing without SHAP.")
    else:
        logger.info("SHAP skipped (--skip-shap flag)")

    # -- Save run metadata ------------------------------------------
    elapsed = time.time() - start_time
    run_metadata["elapsed_seconds"] = round(elapsed, 1)
    save_json(run_metadata, REPORTS_DIR / "run_metadata.json")
    # Also save training date into test_metrics for API model-info
    metrics["training_date"] = datetime.now().strftime("%Y-%m-%d")
    save_json(metrics, REPORTS_DIR / "test_metrics.json")

    logger.info(
        f"\n{'='*60}\n"
        f"  PIPELINE COMPLETE in {elapsed:.1f}s\n"
        f"\n  Artifacts:\n"
        f"    Model  -> {MODELS_DIR}/best_model.pkl\n"
        f"    Metrics-> {REPORTS_DIR}/test_metrics.json\n"
        f"    SHAP   -> {REPORTS_DIR}/shap_summary.png\n"
        f"\n  Start API:\n"
        f"    uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload\n"
        f"{'='*60}"
    )

    return run_metadata


# -----------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------

if __name__ == "__main__":
    args = parse_args()
    run(args)
