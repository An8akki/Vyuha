"""
pipeline/model_selector.py
---------------------------
Decision engine that selects the best model from the training results.

Selection criteria:
  PRIMARY:   ROC-AUC  - discrimination across thresholds
  SECONDARY: PR-AUC   - precision-recall under class imbalance
  TERTIARY:  Recall   - % of real AMR cases caught
  PENALTY:   If FNR > threshold -> subtract penalty (clinical safety)

Rationale: A clinically usable AMR model must not miss too many
resistant patients (high FNR = dangerous). We penalise models that
excel at AUC but have unacceptably high false-negative rates.
"""

import pandas as pd
import numpy as np
from typing import Any, Optional
from pathlib import Path

from pipeline.config import (
    FNR_PENALTY_THRESHOLD, FNR_PENALTY_FACTOR,
    REPORTS_DIR,
)
from pipeline.utils import get_logger, save_json

logger = get_logger(__name__)


class ModelSelector:
    """
    Rank and select the best-performing, clinically-safe model.
    """

    def __init__(self) -> None:
        self.selection_report: dict = {}
        self.selected_model: Optional[Any] = None
        self.selected_model_name: str = ""

    def compute_composite_score(self, metrics: dict) -> float:
        """
        Composite clinical score:

          score = 0.40 × ROC_AUC
                + 0.35 × PR_AUC
                + 0.25 × Recall
                − penalty(FNR)

        Weights reflect:
          • AUC: overall discrimination
          • PR-AUC: performance under imbalance (AMR+ is minority)
          • Recall: catching real AMR patients
          • FNR penalty: clinical safety guard
        """
        auc    = metrics.get("ROC_AUC", 0.0)
        pr_auc = metrics.get("PR_AUC", 0.0)
        recall = metrics.get("Recall", 0.0)
        fnr    = metrics.get("FNR", 0.0)

        score = (0.40 * auc) + (0.35 * pr_auc) + (0.25 * recall)

        if fnr > FNR_PENALTY_THRESHOLD:
            penalty = FNR_PENALTY_FACTOR * (fnr - FNR_PENALTY_THRESHOLD)
            score -= penalty
            logger.info(
                f"  FNR={fnr:.3f} > threshold={FNR_PENALTY_THRESHOLD} "
                f"-> applying clinical penalty -{penalty:.4f}"
            )

        return round(score, 4)

    def select(
        self,
        model_results: list[dict],
    ) -> dict:
        """
        Given a list of {name, model, metrics} dicts, select the best.

        Parameters
        ----------
        model_results : list of dicts, each with keys:
            - 'name': str model name
            - 'model': the fitted PyCaret / sklearn pipeline
            - 'metrics': dict from evaluate_test()
        """
        if not model_results:
            raise ValueError("model_results is empty.")

        logger.info("-" * 60)
        logger.info("Running model selection decision engine...")

        rows = []
        for result in model_results:
            metrics = result["metrics"]
            score   = self.compute_composite_score(metrics)
            rows.append({
                "model_name":  result["name"],
                "ROC_AUC":    metrics.get("ROC_AUC", 0),
                "PR_AUC":     metrics.get("PR_AUC", 0),
                "Recall":     metrics.get("Recall", 0),
                "Specificity": metrics.get("Specificity", 0),
                "F1":         metrics.get("F1", 0),
                "FNR":        metrics.get("FNR", 0),
                "composite_score": score,
            })

        ranking = pd.DataFrame(rows).sort_values("composite_score", ascending=False)
        logger.info(f"\nModel Ranking:\n{ranking.to_string(index=False)}")

        # Persist ranking
        ranking.to_csv(REPORTS_DIR / "model_ranking.csv", index=False)
        save_json(ranking.to_dict(orient="records"), REPORTS_DIR / "model_ranking.json")

        # Best model
        best_idx  = ranking.iloc[0]["model_name"]
        best_result = next(r for r in model_results if r["name"] == best_idx)

        self.selected_model      = best_result["model"]
        self.selected_model_name = best_idx
        self.selection_report    = ranking.iloc[0].to_dict()

        logger.info(
            f"\n{'='*50}\n"
            f"  SELECTED MODEL: {self.selected_model_name}\n"
            f"  Composite Score: {self.selection_report['composite_score']:.4f}\n"
            f"  ROC-AUC:  {self.selection_report['ROC_AUC']:.4f}\n"
            f"  PR-AUC:   {self.selection_report['PR_AUC']:.4f}\n"
            f"  Recall:   {self.selection_report['Recall']:.4f}\n"
            f"  FNR:      {self.selection_report['FNR']:.4f}\n"
            f"{'='*50}"
        )

        return best_result
