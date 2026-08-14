"""
pipeline/feature_engineer.py
-----------------------------
Derives clinically meaningful features from the unified table.

Principles:
  • Every derived feature must be clinically interpretable.
  • No "feature engineering confetti" - only features backed by clinical logic.
  • Missingness indicators are created BEFORE imputation so that the model
    can distinguish "low value" from "test not performed".
  • Derived composite scores (SIRS, shock index) are clinically validated constructs.
"""

import pandas as pd
import numpy as np
from typing import List

from pipeline.config import (
    TARGET_COL, PATIENT_ID_COL, ENCOUNTER_ID_COL, ORDER_ID_COL,
    CLINICAL_RANGES,
    FEVER_THRESHOLD, HYPOTHERMIA_THRESHOLD, TACHYCARDIA_THRESHOLD,
    TACHYPNEA_THRESHOLD, HYPOTENSION_SBP,
    WBC_HIGH, WBC_LOW, CREATININE_HIGH, LACTATE_HIGH, PROCALCITONIN_HIGH,
    MISSINGNESS_INDICATOR_COLS,
)
from pipeline.utils import get_logger, age_bucket_to_midpoint

logger = get_logger(__name__)

# -----------------------------------------------------------------
# Columns that are identifiers / metadata - never used as features
# -----------------------------------------------------------------
ID_COLS = [
    PATIENT_ID_COL, ENCOUNTER_ID_COL, ORDER_ID_COL,
    "order_time_jittered_utc", "susceptibility", "was_positive",
    "ordering_mode",
]


class FeatureEngineer:
    """Transform raw unified table into clinically-engineered feature matrix."""

    def __init__(self) -> None:
        self.feature_columns: List[str] = []

    # -------------------------------------------------------------
    # Step 1: Missingness indicators (BEFORE imputation)
    # -------------------------------------------------------------

    def _add_missingness_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        For key clinical variables: add a binary flag indicating the value
        was MISSING (not just low).

        Rationale: procalcitonin_missing ≠ procalcitonin = 0.
        The test not being ordered itself carries clinical meaning.
        """
        for col in MISSINGNESS_INDICATOR_COLS:
            if col in df.columns:
                indicator = f"{col}_missing"
                df[indicator] = df[col].isna().astype(int)
                logger.debug(f"  Missingness indicator: {indicator} "
                             f"({df[indicator].sum()} missing)")
        return df

    # -------------------------------------------------------------
    # Step 2: Age decoding
    # -------------------------------------------------------------

    def _decode_age(self, df: pd.DataFrame) -> pd.DataFrame:
        if "age" in df.columns:
            df["age"] = df["age"].apply(age_bucket_to_midpoint)
        return df

    # -------------------------------------------------------------
    # Step 3: Clinical range capping (outlier handling)
    # -------------------------------------------------------------

    def _cap_clinical_ranges(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Values outside physiologically plausible ranges are capped to the
        boundary, not dropped. This preserves extreme-but-real values while
        preventing them from dominating tree splits.
        """
        for col, (lo, hi) in CLINICAL_RANGES.items():
            if col in df.columns:
                n_below = (df[col] < lo).sum()
                n_above = (df[col] > hi).sum()
                if n_below + n_above > 0:
                    logger.debug(f"  Capping {col}: {n_below} below {lo}, {n_above} above {hi}")
                df[col] = df[col].clip(lower=lo, upper=hi)
        return df

    # -------------------------------------------------------------
    # Step 4: Derived clinical features
    # -------------------------------------------------------------

    def _derive_clinical_features(self, df: pd.DataFrame) -> pd.DataFrame:
        # -- Haemodynamic features --------------------------------
        if "sbp" in df.columns and "dbp" in df.columns:
            df["map"] = (df["sbp"] + 2 * df["dbp"]) / 3       # Mean Arterial Pressure
            df["pulse_pressure"] = df["sbp"] - df["dbp"]

        if "heart_rate" in df.columns and "sbp" in df.columns:
            df["shock_index"] = df["heart_rate"] / df["sbp"].replace(0, np.nan)

        # -- Binary clinical flags ---------------------------------
        if "temperature" in df.columns:
            df["fever"]        = (df["temperature"] >= FEVER_THRESHOLD).astype(int)
            df["hypothermia"]  = (df["temperature"] < HYPOTHERMIA_THRESHOLD).astype(int)

        if "heart_rate" in df.columns:
            df["tachycardia"] = (df["heart_rate"] > TACHYCARDIA_THRESHOLD).astype(int)

        if "respiratory_rate" in df.columns:
            df["tachypnea"] = (df["respiratory_rate"] > TACHYPNEA_THRESHOLD).astype(int)

        if "sbp" in df.columns:
            df["hypotension"] = (df["sbp"] < HYPOTENSION_SBP).astype(int)

        # -- Lab-derived features ---------------------------------
        if "wbc" in df.columns:
            df["leukocytosis"]  = (df["wbc"] > WBC_HIGH).astype(int)
            df["leukopenia"]    = (df["wbc"] < WBC_LOW).astype(int)

        if "neutrophils" in df.columns and "wbc" in df.columns:
            # Neutrophil-to-WBC ratio (marker of left shift / bacterial infection)
            df["neutrophil_ratio"] = df["neutrophils"] / df["wbc"].replace(0, np.nan)
            df["neutrophil_ratio"] = df["neutrophil_ratio"].clip(0.0, 1.0)

        if "creatinine" in df.columns:
            df["renal_dysfunction"] = (df["creatinine"] > CREATININE_HIGH).astype(int)

        if "lactate" in df.columns:
            df["elevated_lactate"] = (df["lactate"] > LACTATE_HIGH).astype(int)

        if "procalcitonin" in df.columns:
            df["elevated_pct"] = (df["procalcitonin"] > PROCALCITONIN_HIGH).astype(int)

        # -- SIRS score (validated clinical construct) -------------
        # SIRS criteria: ≥2 of {fever/hypothermia, tachycardia,
        # tachypnea, leukocytosis/leukopenia}
        sirs_components = []
        for c in ["fever", "hypothermia", "tachycardia", "tachypnea",
                  "leukocytosis", "leukopenia"]:
            if c in df.columns:
                sirs_components.append(df[c])
        if sirs_components:
            df["sirs_score"] = sum(sirs_components).fillna(0).astype(int)
            df["sirs_positive"] = (df["sirs_score"] >= 2).astype(int)

        # -- Sepsis indicator (SIRS + organ dysfunction proxy) -----
        organ_dysfunction = pd.Series(0, index=df.index)
        for c in ["renal_dysfunction", "elevated_lactate", "elevated_pct"]:
            if c in df.columns:
                organ_dysfunction = organ_dysfunction | df[c].fillna(0).astype(int)
        if "sirs_positive" in df.columns:
            df["sepsis_indicator"] = (df["sirs_positive"] & organ_dysfunction).astype(int)

        # -- Vital trend features (delta = last - first) -----------
        if "last_heartrate" in df.columns and "first_heartrate" in df.columns:
            df["hr_trend"] = (
                pd.to_numeric(df["last_heartrate"], errors="coerce")
                - pd.to_numeric(df["first_heartrate"], errors="coerce")
            )
        if "last_temp" in df.columns and "first_temp" in df.columns:
            df["temp_trend"] = (
                pd.to_numeric(df["last_temp"], errors="coerce")
                - pd.to_numeric(df["first_temp"], errors="coerce")
            )
        if "last_cr" in df.columns and "first_cr" in df.columns:
            df["creatinine_trend"] = (
                pd.to_numeric(df["last_cr"], errors="coerce")
                - pd.to_numeric(df["first_cr"], errors="coerce")
            )

        return df

    # -------------------------------------------------------------
    # Step 5: Organism / antibiotic grouping
    # -------------------------------------------------------------

    def _group_organism(self, df: pd.DataFrame, top_n: int = 20) -> pd.DataFrame:
        """
        Keep top N organisms by frequency; collapse rest to 'Other'.
        This controls cardinality for one-hot encoding downstream.
        """
        if "organism" not in df.columns:
            return df
        top_orgs = df["organism"].value_counts().head(top_n).index.tolist()
        df["organism_group"] = df["organism"].where(
            df["organism"].isin(top_orgs), other="Other"
        )
        return df

    def _group_antibiotic(self, df: pd.DataFrame, top_n: int = 30) -> pd.DataFrame:
        """Similarly cap antibiotic cardinality."""
        if "suspected_antibiotic" not in df.columns:
            return df
        top_abx = df["suspected_antibiotic"].value_counts().head(top_n).index.tolist()
        df["antibiotic_group"] = df["suspected_antibiotic"].where(
            df["suspected_antibiotic"].isin(top_abx), other="Other_ABX"
        )
        return df

    # -------------------------------------------------------------
    # Step 6: Drop raw redundant columns after deriving features
    # -------------------------------------------------------------

    def _drop_raw_redundant(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Drop columns that were used only to compute derived features
        or that are identifiers not passed to the model.
        NOTE: PATIENT_ID_COL (anon_id) is intentionally kept here so that
        preprocessor.patient_level_split() can use it. It is removed from
        the feature matrix later in preprocessor.split_xy().
        """
        drop_cols = [
            # Identifiers (keep PATIENT_ID_COL for patient-level split)
            ENCOUNTER_ID_COL, ORDER_ID_COL,
            "order_time_jittered_utc", "susceptibility", "was_positive",
            "ordering_mode",
            # Trend sources (encoded into trend features)
            "first_heartrate", "last_heartrate", "first_temp", "last_temp",
            "first_sysbp", "last_sysbp",
            "first_cr", "last_cr",
            "first_wbc", "last_wbc",
            "first_lactate", "last_lactate",
            # Raw organism / antibiotic (grouped versions used)
            "organism", "suspected_antibiotic",
        ]
        df = df.drop(columns=[c for c in drop_cols if c in df.columns])
        return df

    # -------------------------------------------------------------
    # Main entry
    # -------------------------------------------------------------

    def engineer(self, unified: pd.DataFrame) -> pd.DataFrame:
        """
        Apply full feature engineering pipeline.
        Returns a DataFrame ready for preprocessing -> model training.
        The TARGET_COL (AMR_RISK) is preserved in the output.
        """
        logger.info("------------------------------------------------------------")
        logger.info("Starting feature engineering...")

        df = unified.copy()

        df = self._add_missingness_indicators(df)
        logger.info("  [OK] Missingness indicators added")

        df = self._decode_age(df)
        logger.info("  [OK] Age bucket decoded to numeric")

        df = self._cap_clinical_ranges(df)
        logger.info("  [OK] Clinical range capping applied")

        df = self._derive_clinical_features(df)
        logger.info(f"  [OK] Clinical features derived (shape: {df.shape})")

        df = self._group_organism(df)
        df = self._group_antibiotic(df)
        logger.info("  [OK] Organism & antibiotic grouped")

        df = self._drop_raw_redundant(df)
        logger.info(f"  [OK] Redundant columns dropped -> final shape: {df.shape}")

        # Record feature columns (excluding target)
        self.feature_columns = [c for c in df.columns if c != TARGET_COL]
        logger.info(f"Feature engineering complete: {len(self.feature_columns)} features")

        return df
