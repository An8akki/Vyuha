"""
pipeline/utils.py
-----------------
Shared helpers used across the AMR pipeline.
"""

import json
import logging
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np


# -----------------------------------------------------------------
# Logging
# -----------------------------------------------------------------

def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Return a consistently formatted logger for the given module name."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        # Force UTF-8 so Unicode chars (arrows, ticks) don't crash on Windows cp1252
        import io
        utf8_stream = io.TextIOWrapper(
            sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True
        ) if hasattr(sys.stdout, "buffer") else sys.stdout
        handler = logging.StreamHandler(utf8_stream)
        fmt = logging.Formatter(
            "[%(asctime)s] %(levelname)-8s %(name)s - %(message)s",
            datefmt="%H:%M:%S",
        )
        handler.setFormatter(fmt)
        logger.addHandler(handler)
    logger.setLevel(level)
    return logger


# -----------------------------------------------------------------
# Age bucket -> numeric midpoint
# Bins in the dataset: "18-24 years", "25-34 years", ..., "90+"
# -----------------------------------------------------------------

_AGE_MIDPOINTS: dict[str, float] = {
    "18-24 years": 21.0,
    "25-34 years": 29.5,
    "35-44 years": 39.5,
    "45-54 years": 49.5,
    "55-64 years": 59.5,
    "65-74 years": 69.5,
    "75-84 years": 79.5,
    "85-89 years": 87.0,
    "90+":         92.0,
    # common variants
    "18-24":       21.0,
    "25-34":       29.5,
    "35-44":       39.5,
    "45-54":       49.5,
    "55-64":       59.5,
    "65-74":       69.5,
    "75-84":       79.5,
    "85-89":       87.0,
}


def age_bucket_to_midpoint(age_val: Any) -> float:
    """
    Convert an age bucket string (e.g. '55-64 years') to its numeric midpoint.
    Falls back to regex extraction if not in lookup table.
    Returns np.nan for unparseable values.
    """
    if age_val is None or (isinstance(age_val, float) and np.isnan(age_val)):
        return np.nan
    age_str = str(age_val).strip()
    # Direct lookup
    if age_str in _AGE_MIDPOINTS:
        return _AGE_MIDPOINTS[age_str]
    # Parse "X-Y" pattern
    m = re.search(r"(\d+)\s*[-–]\s*(\d+)", age_str)
    if m:
        lo, hi = float(m.group(1)), float(m.group(2))
        return (lo + hi) / 2.0
    # "90+" or any single number
    m2 = re.search(r"(\d+)\+?", age_str)
    if m2:
        return float(m2.group(1))
    return np.nan


# -----------------------------------------------------------------
# JSON I/O
# -----------------------------------------------------------------

class _NumpyEncoder(json.JSONEncoder):
    """JSON encoder that handles numpy types."""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def save_json(obj: dict, path: Path) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, cls=_NumpyEncoder, indent=2)


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# -----------------------------------------------------------------
# Risk tier helper
# -----------------------------------------------------------------

def get_risk_tier(probability: float) -> str:
    """Classify AMR probability into LOW / MODERATE / HIGH."""
    from pipeline.config import RISK_THRESHOLDS
    if probability < RISK_THRESHOLDS["LOW"]:
        return "LOW"
    elif probability < RISK_THRESHOLDS["MODERATE"]:
        return "MODERATE"
    return "HIGH"


def get_risk_color(tier: str) -> str:
    return {"LOW": "green", "MODERATE": "amber", "HIGH": "red"}.get(tier, "grey")
