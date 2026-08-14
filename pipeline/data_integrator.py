"""
pipeline/data_integrator.py
---------------------------
Merges all loaded DataFrames into a single patient-encounter-level
unified table and creates the AMR_RISK label.

Each row in the output represents one clinical episode:
  (patient_id × encounter_id × culture × antibiotic)

Key operations:
  1. Label creation from cohort susceptibility
  2. Left-join demographics, vitals, labs, ward_info on order_proc_id_coded
  3. Pivot prior medications -> antibiotic_pressure_score + class flags
  4. Pivot procedures -> binary procedure flags
  5. Pivot prior organisms -> previous_culture_positive, previous_amr proxy
"""

import pandas as pd
import numpy as np
from typing import Optional

from pipeline.config import (
    ORDER_ID_COL, PATIENT_ID_COL, ENCOUNTER_ID_COL,
    TARGET_COL, RESISTANT_LABEL,
    PRIOR_ABX_WINDOW_DAYS, PRIOR_PROCEDURE_WINDOW_DAYS, PRIOR_ORGANISM_WINDOW_DAYS,
    TOP_ORGANISMS, TOP_ABX_CATEGORIES, TOP_PROCEDURES,
)
from pipeline.utils import get_logger

logger = get_logger(__name__)


# -----------------------------------------------------------------
# Known immunosuppressant medication keywords (for proxy feature)
# -----------------------------------------------------------------
IMMUNOSUPPRESSANT_KEYWORDS = [
    "prednisone", "prednisolone", "methylprednisolone", "dexamethasone",
    "tacrolimus", "cyclosporine", "mycophenolate", "azathioprine",
    "methotrexate", "cyclophosphamide", "rituximab", "sirolimus",
    "everolimus", "leflunomide", "hydroxychloroquine",
]


class DataIntegrator:
    """Integrate all ARMD tables into a unified ML-ready wide table."""

    def __init__(self) -> None:
        self.unified: Optional[pd.DataFrame] = None

    # -------------------------------------------------------------
    # Label
    # -------------------------------------------------------------

    def _make_label(self, cohort: pd.DataFrame) -> pd.DataFrame:
        """
        AMR_RISK = 1 if susceptibility == 'Resistant', else 0.
        Label comes purely from culture/AST - no leakage from treatment decisions.
        """
        cohort = cohort.copy()
        cohort[TARGET_COL] = (
            cohort["susceptibility"].str.strip().str.capitalize() == RESISTANT_LABEL
        ).astype(int)
        logger.info(
            f"  Label distribution -> "
            f"Resistant(1)={cohort[TARGET_COL].sum():,} "
            f"({cohort[TARGET_COL].mean()*100:.1f}%) | "
            f"Susceptible/Intermediate(0)={(cohort[TARGET_COL]==0).sum():,}"
        )
        return cohort

    # -------------------------------------------------------------
    # Prior medications -> antibiotic exposure features
    # -------------------------------------------------------------

    def _pivot_prior_med(self, prior_med: pd.DataFrame) -> pd.DataFrame:
        """
        From long prior-medication table, create per-order features:
          - recent_antibiotic_use: any antibiotic within PRIOR_ABX_WINDOW_DAYS
          - antibiotic_pressure_score: count of distinct categories (recent window)
          - immunosuppression: any immunosuppressant medication ever recorded
          - abx_<class>: binary flag per top antibiotic category (recent window)
        """
        if prior_med.empty:
            return pd.DataFrame(columns=[ORDER_ID_COL])

        df = prior_med.copy()
        time_col = "medication_time_to_culturetime"
        cat_col  = "medication_category"
        name_col = "medication_name"

        # Coerce time to numeric (some may be string 'Null')
        df[time_col] = pd.to_numeric(df[time_col], errors="coerce")

        # -- Recent window (e.g., -90 to 0 days) ----------------
        recent = df[df[time_col].between(PRIOR_ABX_WINDOW_DAYS, 0)].copy()

        # recent_antibiotic_use flag
        has_recent = (
            recent.groupby(ORDER_ID_COL)[time_col]
            .count()
            .rename("recent_antibiotic_use")
            .gt(0)
            .astype(int)
        )

        # antibiotic_pressure_score = count of distinct categories
        pressure_score = (
            recent.groupby(ORDER_ID_COL)[cat_col]
            .nunique()
            .rename("antibiotic_pressure_score")
        )

        # Top antibiotic categories -> binary flags
        top_cats = (
            recent[cat_col].dropna().value_counts()
            .head(TOP_ABX_CATEGORIES).index.tolist()
        )
        cat_dummies_list = []
        for cat in top_cats:
            flag = (
                recent[recent[cat_col] == cat]
                .groupby(ORDER_ID_COL)[cat_col]
                .count()
                .gt(0)
                .astype(int)
                .rename(f"abx_{cat.replace(' ', '_').lower()}")
            )
            cat_dummies_list.append(flag)

        # -- Immunosuppression (any window) ----------------------
        if name_col in df.columns:
            df_lower = df[name_col].str.lower().fillna("")
            immuno_mask = df_lower.str.contains(
                "|".join(IMMUNOSUPPRESSANT_KEYWORDS), na=False
            )
            immuno_flag = (
                df[immuno_mask]
                .groupby(ORDER_ID_COL)[name_col]
                .count()
                .gt(0)
                .astype(int)
                .rename("immunosuppression")
            )
        else:
            immuno_flag = pd.Series(dtype=int, name="immunosuppression")

        # Combine
        result = pd.concat(
            [has_recent, pressure_score, immuno_flag] + cat_dummies_list,
            axis=1,
        ).reset_index()

        logger.info(f"  Prior-med pivot: {result.shape}")
        return result

    # -------------------------------------------------------------
    # Prior procedures -> binary procedure flags + comorbidity proxy
    # -------------------------------------------------------------

    def _pivot_procedures(self, procedures: pd.DataFrame) -> pd.DataFrame:
        if procedures.empty:
            return pd.DataFrame(columns=[ORDER_ID_COL])

        df = procedures.copy()
        time_col = "procedure_time_to_culturetime"
        desc_col = "procedure_description"

        df[time_col] = pd.to_numeric(df[time_col], errors="coerce")

        # Recent window
        recent = df[df[time_col].between(PRIOR_PROCEDURE_WINDOW_DAYS, 0)].copy()

        # comorbidity_count proxy: distinct procedure types (all time, not just recent)
        comorbidity_count = (
            df.groupby(ORDER_ID_COL)[desc_col]
            .nunique()
            .rename("comorbidity_count")
        )

        # Top procedure binary flags (recent window)
        top_procs = (
            recent[desc_col].dropna().value_counts()
            .head(TOP_PROCEDURES).index.tolist()
        )
        proc_flags = []
        for proc in top_procs:
            safe_name = proc.replace(" ", "_").replace("-", "_").lower()
            flag = (
                recent[recent[desc_col] == proc]
                .groupby(ORDER_ID_COL)[desc_col]
                .count()
                .gt(0)
                .astype(int)
                .rename(f"proc_{safe_name}")
            )
            proc_flags.append(flag)

        result = pd.concat(
            [comorbidity_count] + proc_flags, axis=1
        ).reset_index()

        logger.info(f"  Procedure pivot: {result.shape}")
        return result

    # -------------------------------------------------------------
    # Prior organisms -> previous infection & AMR proxy
    # -------------------------------------------------------------

    def _pivot_prior_organisms(self, prior_organisms: pd.DataFrame) -> pd.DataFrame:
        if prior_organisms.empty:
            return pd.DataFrame(columns=[ORDER_ID_COL])

        df = prior_organisms.copy()
        # Typo in actual column name: 'culutre' not 'culture'
        time_col = next(
            (c for c in df.columns if "days_to_cul" in c.lower()), None
        )
        org_col = "prior_organism"

        if time_col:
            df[time_col] = pd.to_numeric(df[time_col], errors="coerce")
            # Positive = prior infection was BEFORE this culture (what we want)
            within_window = df[
                df[time_col].between(1, abs(PRIOR_ORGANISM_WINDOW_DAYS))
            ].copy()
        else:
            within_window = df.copy()

        # previous_culture_positive: any prior organism
        prev_pos = (
            within_window.groupby(ORDER_ID_COL)[org_col]
            .count()
            .gt(0)
            .astype(int)
            .rename("previous_culture_positive")
        )

        # previous_amr proxy: patient had ≥2 distinct prior organisms
        # (multiple infections ↔ higher risk profile)
        prev_amr_proxy = (
            within_window.groupby(ORDER_ID_COL)[org_col]
            .nunique()
            .ge(2)
            .astype(int)
            .rename("previous_amr")
        )

        # Top prior organisms as binary flags
        top_orgs = (
            within_window[org_col].dropna().value_counts()
            .head(TOP_ORGANISMS).index.tolist()
        )
        org_flags = []
        for org in top_orgs:
            safe = org.replace(" ", "_").lower()
            flag = (
                within_window[within_window[org_col] == org]
                .groupby(ORDER_ID_COL)[org_col]
                .count()
                .gt(0)
                .astype(int)
                .rename(f"prior_org_{safe}")
            )
            org_flags.append(flag)

        result = pd.concat(
            [prev_pos, prev_amr_proxy] + org_flags, axis=1
        ).reset_index()

        logger.info(f"  Prior-organism pivot: {result.shape}")
        return result

    # -------------------------------------------------------------
    # Main integration
    # -------------------------------------------------------------

    def integrate(self, data: dict[str, pd.DataFrame]) -> pd.DataFrame:
        """
        Merge all tables into a single unified DataFrame.

        Row granularity: one row per (order_proc_id_coded × antibiotic)
        = one culture-antibiotic susceptibility test per clinical episode.

        The antibiotic being tested is included as a categorical feature
        (global model - antibiotic as a predictor, not separate models).
        """
        logger.info("-" * 60)
        logger.info("Starting data integration...")

        # -- 1. Base: labelled cohort -----------------------------
        base = self._make_label(data["cohort"])
        n_base = len(base)
        logger.info(f"  Base cohort: {n_base:,} rows")

        # -- 2. Demographics --------------------------------------
        demo = data["demographics"].drop_duplicates(subset=[ORDER_ID_COL])
        base = base.merge(demo, on=ORDER_ID_COL, how="left", suffixes=("", "_demo"))

        # -- 3. Vitals --------------------------------------------
        vitals = data["vitals"].drop_duplicates(subset=[ORDER_ID_COL])
        base = base.merge(vitals, on=ORDER_ID_COL, how="left", suffixes=("", "_vit"))

        # -- 4. Labs ----------------------------------------------
        labs = data["labs"].drop_duplicates(subset=[ORDER_ID_COL])
        base = base.merge(labs, on=ORDER_ID_COL, how="left", suffixes=("", "_lab"))

        # -- 5. Ward info -----------------------------------------
        ward = data["ward_info"].drop_duplicates(subset=[ORDER_ID_COL])
        base = base.merge(ward, on=ORDER_ID_COL, how="left", suffixes=("", "_ward"))

        # -- 6. Prior medications (pivoted) -----------------------
        med_features = self._pivot_prior_med(data["prior_med"])
        if not med_features.empty:
            base = base.merge(med_features, on=ORDER_ID_COL, how="left")

        # -- 7. Procedures (pivoted) ------------------------------
        proc_features = self._pivot_procedures(data["procedures"])
        if not proc_features.empty:
            base = base.merge(proc_features, on=ORDER_ID_COL, how="left")

        # -- 8. Prior organisms (pivoted) -------------------------
        org_features = self._pivot_prior_organisms(data["prior_organisms"])
        if not org_features.empty:
            base = base.merge(org_features, on=ORDER_ID_COL, how="left")

        # -- 9. Fill binary flags (missing = not recorded = 0) ----
        binary_prefix_cols = [
            c for c in base.columns
            if c.startswith(("abx_", "proc_", "prior_org_",
                             "recent_antibiotic_use", "immunosuppression",
                             "previous_culture_positive", "previous_amr",
                             "hosp_ward_"))
        ]
        base[binary_prefix_cols] = base[binary_prefix_cols].fillna(0).astype(int)

        # -- 10. Standardise column names -------------------------
        base = base.rename(columns={
            "median_heartrate":    "heart_rate",
            "median_resprate":     "respiratory_rate",
            "median_temp":         "temperature",
            "median_sysbp":        "sbp",
            "median_diasbp":       "dbp",
            "median_wbc":          "wbc",
            "median_neutrophils":  "neutrophils",
            "median_cr":           "creatinine",
            "median_lactate":      "lactate",
            "median_procalcitonin":"procalcitonin",
            "hosp_ward_ICU":       "icu_exposure",
            "culture_description": "infection_source",
            "antibiotic":          "suspected_antibiotic",
        })

        # -- 11. Drop duplicate identifier columns from merges ----
        dup_cols = [c for c in base.columns if c.endswith(("_demo", "_vit", "_lab", "_ward"))]
        base = base.drop(columns=dup_cols, errors="ignore")

        self.unified = base
        logger.info(f"Integration complete: {base.shape} | "
                    f"Columns: {list(base.columns)}")
        return base
