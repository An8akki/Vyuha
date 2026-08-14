"""
pipeline/data_loader.py
-----------------------
Responsible for loading each raw CSV file from disk with appropriate
sampling, null handling, and memory-safe chunked reading for large files.

Design principles:
  • No feature engineering or label creation here - raw shapes only.
  • Large files (>100 MB) are read in chunks and filtered to the set of
    order_proc_id_coded values present in the sampled cohort.
  • All "Null" string values are treated as NaN.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional

from pipeline.config import (
    CSV, COHORT_SAMPLE_ROWS, NULL_VALUES, RANDOM_STATE,
    ORDER_ID_COL, PATIENT_ID_COL, ENCOUNTER_ID_COL,
)
from pipeline.utils import get_logger

logger = get_logger(__name__)


class DataLoader:
    """Load and lightly sanitise each ARMD CSV file."""

    # -- Chunk size for large files ------------------------------
    _CHUNK_SIZE = 100_000

    def __init__(self) -> None:
        self._order_ids: Optional[set] = None   # set after cohort is loaded

    # -------------------------------------------------------------
    # Base cohort
    # -------------------------------------------------------------

    def load_cohort(self, sample_rows: int = COHORT_SAMPLE_ROWS) -> pd.DataFrame:
        """
        Load the primary cohort file.

        Filters:
          - was_positive == 1 (culture confirmed an organism)
          - susceptibility not null (AST result available - this IS the label)

        Samples up to `sample_rows` for hackathon speed.
        The over-read factor (3×) ensures we have enough after filtering.
        """
        logger.info(f"Loading cohort CSV (target {sample_rows:,} filtered rows)...")
        path = CSV["cohort"]

        # Read in one pass; file is ~257 MB, manageable with nrows
        df = pd.read_csv(
            path,
            nrows=sample_rows * 4,          # over-read before filter
            na_values=NULL_VALUES,
            low_memory=False,
        )

        # Quality filter
        df = df[df["was_positive"] == 1].copy()
        df = df[df["susceptibility"].notna()].copy()
        df = df[df["organism"].notna()].copy()
        df = df[df["antibiotic"].notna()].copy()

        # Sample
        if len(df) > sample_rows:
            df = df.sample(sample_rows, random_state=RANDOM_STATE).reset_index(drop=True)

        logger.info(f"  Cohort loaded: {df.shape} | "
                    f"Resistant: {(df['susceptibility']=='Resistant').sum():,} | "
                    f"Susceptible: {(df['susceptibility']!='Resistant').sum():,}")

        # Cache order IDs for downstream filtered loads
        self._order_ids = set(df[ORDER_ID_COL].unique())
        logger.info(f"  Unique order IDs: {len(self._order_ids):,}")
        return df

    # -------------------------------------------------------------
    # Demographics
    # -------------------------------------------------------------

    def load_demographics(self) -> pd.DataFrame:
        logger.info("Loading demographics...")
        df = pd.read_csv(CSV["demographics"], na_values=NULL_VALUES, low_memory=False)
        logger.info(f"  Demographics: {df.shape}")
        return df[[PATIENT_ID_COL, ENCOUNTER_ID_COL, ORDER_ID_COL, "age", "gender"]]

    # -------------------------------------------------------------
    # Vitals
    # -------------------------------------------------------------

    def load_vitals(self) -> pd.DataFrame:
        logger.info("Loading vitals...")
        df = pd.read_csv(CSV["vitals"], na_values=NULL_VALUES, low_memory=False)

        # Select median vitals + first/last for trend awareness
        cols_keep = [
            ORDER_ID_COL, PATIENT_ID_COL, ENCOUNTER_ID_COL,
            "median_heartrate", "median_resprate", "median_temp",
            "median_sysbp",     "median_diasbp",
            "first_heartrate",  "last_heartrate",
            "first_temp",       "last_temp",
            "first_sysbp",      "last_sysbp",
        ]
        cols_keep = [c for c in cols_keep if c in df.columns]
        logger.info(f"  Vitals: {df.shape}")
        return df[cols_keep]

    # -------------------------------------------------------------
    # Labs - prefer Period_Day = 0 (day of culture)
    # -------------------------------------------------------------

    def load_labs(self) -> pd.DataFrame:
        logger.info("Loading labs (preferring Period_Day=0)...")
        df = pd.read_csv(CSV["labs"], na_values=NULL_VALUES, low_memory=False)

        # Keep the closest available period to culture time (day 0 first)
        if "Period_Day" in df.columns:
            # Sort so that 0 comes first, then pick first per order
            df = df.sort_values(
                [ORDER_ID_COL, "Period_Day"],
                key=lambda s: s.abs() if s.name == "Period_Day" else s,
            )
            df = df.drop_duplicates(subset=[ORDER_ID_COL], keep="first")

        key_labs = [
            "median_wbc", "median_neutrophils", "median_lymphocytes",
            "median_cr",  "median_lactate",     "median_procalcitonin",
            "median_hgb", "median_plt",         "median_bun",
            "first_wbc",  "last_wbc",
            "first_cr",   "last_cr",
            "first_lactate", "last_lactate",
        ]
        cols_keep = [ORDER_ID_COL, PATIENT_ID_COL, ENCOUNTER_ID_COL] + [
            c for c in key_labs if c in df.columns
        ]
        logger.info(f"  Labs: {df.shape} -> {len(cols_keep)} columns selected")
        return df[cols_keep]

    # -------------------------------------------------------------
    # Ward info
    # -------------------------------------------------------------

    def load_ward_info(self) -> pd.DataFrame:
        logger.info("Loading ward info...")
        df = pd.read_csv(CSV["ward_info"], na_values=NULL_VALUES, low_memory=False)
        cols_keep = [ORDER_ID_COL, PATIENT_ID_COL, ENCOUNTER_ID_COL,
                     "hosp_ward_IP", "hosp_ward_OP", "hosp_ward_ER", "hosp_ward_ICU"]
        cols_keep = [c for c in cols_keep if c in df.columns]
        logger.info(f"  Ward info: {df.shape}")
        return df[cols_keep]

    # -------------------------------------------------------------
    # Prior medications  (153 MB - chunked & filtered)
    # -------------------------------------------------------------

    def load_prior_med(self) -> pd.DataFrame:
        """
        Load prior medication records for the sampled order IDs.
        Returns the raw long-format table (one row per medication record).
        Aggregation into features happens in data_integrator.py.
        """
        if self._order_ids is None:
            raise RuntimeError("Call load_cohort() before load_prior_med().")

        logger.info("Loading prior medications (chunked filter)...")
        chunks = []
        for chunk in pd.read_csv(
            CSV["prior_med"],
            chunksize=self._CHUNK_SIZE,
            na_values=NULL_VALUES,
            low_memory=False,
        ):
            mask = chunk[ORDER_ID_COL].isin(self._order_ids)
            if mask.any():
                chunks.append(chunk[mask])

        df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
        logger.info(f"  Prior meds: {df.shape}")
        return df

    # -------------------------------------------------------------
    # Prior procedures  (129 MB - chunked & filtered)
    # -------------------------------------------------------------

    def load_procedures(self) -> pd.DataFrame:
        if self._order_ids is None:
            raise RuntimeError("Call load_cohort() before load_procedures().")

        logger.info("Loading prior procedures (chunked filter)...")
        chunks = []
        for chunk in pd.read_csv(
            CSV["procedures"],
            chunksize=self._CHUNK_SIZE,
            na_values=NULL_VALUES,
            low_memory=False,
        ):
            mask = chunk[ORDER_ID_COL].isin(self._order_ids)
            if mask.any():
                chunks.append(chunk[mask])

        df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
        logger.info(f"  Procedures: {df.shape}")
        return df

    # -------------------------------------------------------------
    # Prior infecting organisms  (81 MB - chunked & filtered)
    # -------------------------------------------------------------

    def load_prior_organisms(self) -> pd.DataFrame:
        if self._order_ids is None:
            raise RuntimeError("Call load_cohort() before load_prior_organisms().")

        logger.info("Loading prior infecting organisms (chunked filter)...")
        chunks = []
        for chunk in pd.read_csv(
            CSV["prior_organism"],
            chunksize=self._CHUNK_SIZE,
            na_values=NULL_VALUES,
            low_memory=False,
        ):
            mask = chunk[ORDER_ID_COL].isin(self._order_ids)
            if mask.any():
                chunks.append(chunk[mask])

        df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()
        logger.info(f"  Prior organisms: {df.shape}")
        return df

    # -------------------------------------------------------------
    # Master loader
    # -------------------------------------------------------------

    def load_all(self) -> dict[str, pd.DataFrame]:
        """
        Load all required data files and return a dict of DataFrames.
        Must be called in order (cohort first to cache order IDs).
        """
        data: dict[str, pd.DataFrame] = {}
        data["cohort"]          = self.load_cohort()
        data["demographics"]    = self.load_demographics()
        data["vitals"]          = self.load_vitals()
        data["labs"]            = self.load_labs()
        data["ward_info"]       = self.load_ward_info()
        data["prior_med"]       = self.load_prior_med()
        data["procedures"]      = self.load_procedures()
        data["prior_organisms"] = self.load_prior_organisms()
        logger.info("All data files loaded [OK]")
        return data
