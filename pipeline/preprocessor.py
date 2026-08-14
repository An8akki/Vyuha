"""
pipeline/preprocessor.py
-------------------------
Preprocessing stage that operates AFTER feature engineering.

Responsibilities:
  1. Patient-level train / validation / test split (no patient leakage)
  2. Class imbalance report + scale_pos_weight computation
  3. Saves split indices for reproducibility

Note: Imputation, scaling, and encoding are handled INSIDE the PyCaret pipeline
to prevent data leakage. This module only does the patient-level data split.
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from typing import Tuple

from pipeline.config import (
    TARGET_COL, PATIENT_ID_COL,
    TRAIN_FRAC, VAL_FRAC, TEST_FRAC,
    RANDOM_STATE, REPORTS_DIR,
)
from pipeline.utils import get_logger, save_json

logger = get_logger(__name__)


class Preprocessor:
    """Handle patient-level splitting and class imbalance reporting."""

    def __init__(self) -> None:
        self.scale_pos_weight: float = 1.0
        self.class_counts: dict = {}
        self.train_patients: set = set()
        self.val_patients:   set = set()
        self.test_patients:  set = set()

    # -------------------------------------------------------------
    # Patient-level split
    # -------------------------------------------------------------

    def patient_level_split(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """
        Split at the PATIENT level so no patient's encounters appear in
        both training and test sets.

        Steps:
          1. Get unique patients
          2. Split patients into train / val / test
          3. Filter rows by patient membership

        This prevents the leakage scenario:
          Patient P001 encounter-1 -> TRAIN
          Patient P001 encounter-2 -> TEST  ← leaks patient-specific signal
        """
        if PATIENT_ID_COL not in df.columns:
            logger.warning(
                f"'{PATIENT_ID_COL}' not found - falling back to random row split"
            )
            return self._random_split(df)

        patients = df[PATIENT_ID_COL].unique()
        n_total  = len(patients)

        # Split patients (stratify not possible at patient level easily,
        # but shuffle ensures representative distribution)
        train_pat, temp_pat = train_test_split(
            patients,
            test_size=(VAL_FRAC + TEST_FRAC),
            random_state=RANDOM_STATE,
            shuffle=True,
        )
        val_ratio = VAL_FRAC / (VAL_FRAC + TEST_FRAC)
        val_pat, test_pat = train_test_split(
            temp_pat,
            test_size=(1 - val_ratio),
            random_state=RANDOM_STATE,
            shuffle=True,
        )

        self.train_patients = set(train_pat)
        self.val_patients   = set(val_pat)
        self.test_patients  = set(test_pat)

        train_df = df[df[PATIENT_ID_COL].isin(self.train_patients)].copy()
        val_df   = df[df[PATIENT_ID_COL].isin(self.val_patients)].copy()
        test_df  = df[df[PATIENT_ID_COL].isin(self.test_patients)].copy()

        logger.info(
            f"Patient-level split:\n"
            f"  Patients total: {n_total:,}\n"
            f"  Train : {len(train_pat):,} patients -> {len(train_df):,} rows "
            f"({train_df[TARGET_COL].mean()*100:.1f}% AMR+)\n"
            f"  Val   : {len(val_pat):,} patients -> {len(val_df):,} rows "
            f"({val_df[TARGET_COL].mean()*100:.1f}% AMR+)\n"
            f"  Test  : {len(test_pat):,} patients -> {len(test_df):,} rows "
            f"({test_df[TARGET_COL].mean()*100:.1f}% AMR+)"
        )

        return train_df, val_df, test_df

    def _random_split(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        train_df, temp_df = train_test_split(
            df, test_size=(VAL_FRAC + TEST_FRAC),
            stratify=df[TARGET_COL], random_state=RANDOM_STATE,
        )
        val_ratio = VAL_FRAC / (VAL_FRAC + TEST_FRAC)
        val_df, test_df = train_test_split(
            temp_df, test_size=(1 - val_ratio),
            stratify=temp_df[TARGET_COL], random_state=RANDOM_STATE,
        )
        logger.info(f"Random split: train={len(train_df):,}, "
                    f"val={len(val_df):,}, test={len(test_df):,}")
        return train_df, val_df, test_df

    # -------------------------------------------------------------
    # Class imbalance
    # -------------------------------------------------------------

    def compute_class_weight(self, train_df: pd.DataFrame) -> float:
        """
        Compute scale_pos_weight for XGBoost / class-weighted models.

        scale_pos_weight = n_negative / n_positive

        This is mathematically equivalent to assigning higher loss weight to
        the minority (resistant) class without creating synthetic samples.
        """
        n_pos = int(train_df[TARGET_COL].sum())
        n_neg = int((train_df[TARGET_COL] == 0).sum())
        n_tot = len(train_df)

        if n_pos == 0:
            raise ValueError("No positive (AMR=1) cases in training set!")

        spw = n_neg / n_pos

        self.class_counts = {
            "AMR_positive": n_pos,
            "AMR_negative": n_neg,
            "total": n_tot,
            "positive_rate_pct": round(n_pos / n_tot * 100, 2),
            "scale_pos_weight": round(spw, 4),
        }
        self.scale_pos_weight = spw

        logger.info(
            f"Class imbalance:\n"
            f"  AMR+ (Resistant):  {n_pos:,} ({n_pos/n_tot*100:.1f}%)\n"
            f"  AMR- (Susceptible): {n_neg:,} ({n_neg/n_tot*100:.1f}%)\n"
            f"  scale_pos_weight:  {spw:.2f}"
        )

        # Save for audit
        save_json(self.class_counts, REPORTS_DIR / "class_balance.json")
        return spw

    # -------------------------------------------------------------
    # Separate X and y
    # -------------------------------------------------------------

    def split_xy(
        self, df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.Series]:
        """Return (X, y) dropping PATIENT_ID_COL from X."""
        drop = [TARGET_COL, PATIENT_ID_COL]
        X = df.drop(columns=[c for c in drop if c in df.columns])
        y = df[TARGET_COL]
        return X, y
