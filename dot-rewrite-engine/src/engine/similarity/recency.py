"""Recency / temporal proximity weighting.

Two notes written close in time are more likely to belong to the same study
session and therefore the same topic. Exponential decay over days.
"""
from __future__ import annotations

from datetime import datetime
import math


def score(a: datetime, b: datetime, half_life_days: float = 7.0) -> float:
    delta = abs((a - b).total_seconds()) / 86400.0
    return math.exp(-math.log(2) * delta / half_life_days)
