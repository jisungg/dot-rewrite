"""Score calibration layer.

Raw scores from different rankings are not directly comparable. A relatedness
of 0.72 and a confusion of 0.72 do not carry the same production meaning.

This module maps raw scores to a calibrated [0,1] scale that is:
  - percentile-normalized within the current space's own distribution, so the
    engine reports what is *unusually high for this space*, not what is
    numerically high on an abstract axis
  - regime-adjusted by corpus size (small / medium / large) so small spaces
    do not over-amplify noise and large spaces do not flatten signal
  - bounded below by a minimum-raw floor so we do not upgrade a garbage 0.05
    score just because it happens to be the top of a weak distribution

Output: CalibratedScore per item with raw, calibrated, percentile, regime,
and a floor_passed flag that gates.py reads.
"""
from __future__ import annotations

import bisect
from dataclasses import dataclass

from .models import CalibratedScore


@dataclass(frozen=True)
class RegimeBands:
    # (raw_floor, percentile_floor_for_top_half)
    small: tuple[float, float] = (0.25, 0.55)
    medium: tuple[float, float] = (0.18, 0.50)
    large: tuple[float, float] = (0.12, 0.45)


def regime_for(n_items: int) -> str:
    if n_items < 6:
        return "small"
    if n_items < 40:
        return "medium"
    return "large"


def _percentile(sorted_values: list[float], x: float) -> float:
    if not sorted_values:
        return 0.0
    idx = bisect.bisect_left(sorted_values, x)
    return idx / len(sorted_values)


def calibrate_list(
    raw_scores: list[float],
    regime: str,
    floors: RegimeBands = RegimeBands(),
    density_factor: float = 1.0,
) -> list[CalibratedScore]:
    """Calibrate a parallel list of raw scores. Length preserved."""
    if not raw_scores:
        return []

    floor, _ = {
        "small": floors.small, "medium": floors.medium, "large": floors.large,
    }.get(regime, floors.medium)
    floor *= density_factor

    sorted_vals = sorted(raw_scores)
    lo, hi = sorted_vals[0], sorted_vals[-1]
    span = max(1e-9, hi - lo)

    out: list[CalibratedScore] = []
    for x in raw_scores:
        pct = _percentile(sorted_vals, x)
        # calibrated score blends raw min-max + percentile to avoid both extremes
        minmax = (x - lo) / span
        cal = 0.6 * pct + 0.4 * minmax
        # regime damping: small spaces get squeezed toward 0.5 (less confident)
        if regime == "small":
            cal = 0.35 + 0.3 * cal
        elif regime == "medium":
            cal = 0.20 + 0.6 * cal
        # else: large spaces use full range
        out.append(CalibratedScore(
            raw=float(x),
            calibrated=float(max(0.0, min(1.0, cal))),
            percentile=float(pct),
            regime=regime,
            floor_passed=x >= floor,
        ))
    return out


def calibrate_map(
    raw_map: dict[str, float],
    regime: str,
    floors: RegimeBands = RegimeBands(),
    density_factor: float = 1.0,
) -> dict[str, CalibratedScore]:
    if not raw_map:
        return {}
    ids = list(raw_map.keys())
    vals = [raw_map[k] for k in ids]
    cals = calibrate_list(vals, regime, floors, density_factor)
    return dict(zip(ids, cals))
