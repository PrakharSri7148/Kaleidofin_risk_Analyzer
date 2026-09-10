"""Deterministic scoring engine.

This is deliberately NOT a model call. The score is a pure function of the
factor data, which is what makes the "what-if" feature possible and the whole
system auditable.

Scaling approach
----------------
Each factor contributes ``value * weight`` to a raw sum, with the sign flipped
when ``direction == "negative"``.

The raw sum is bounded by the factor weights themselves:

    raw_min = -(sum of negative-direction weights)   # every negative maxed, every positive at 0
    raw_max = +(sum of positive-direction weights)   # every positive maxed, every negative at 0

We map the raw sum linearly from [raw_min, raw_max] onto [0, 100]:

    score = round((raw_sum - raw_min) / (raw_max - raw_min) * 100)

So a borrower whose positive and negative factors are all at 0.5 lands exactly
mid-scale, a perfect-on-paper borrower scores 100, and a worst-case borrower
scores 0. The result is clamped to [0, 100] so malformed weights can never
produce an out-of-range score. If a borrower has no factors (or all weights are
zero) the score is 50 by definition.
"""
from __future__ import annotations

from typing import Iterable, Mapping


def _factor_dict(factor) -> dict:
    """Accept either a Pydantic Factor, an ORM-ish object, or a plain dict."""
    if isinstance(factor, Mapping):
        return dict(factor)
    return {
        "name": factor.name,
        "value": factor.value,
        "weight": factor.weight,
        "direction": factor.direction,
    }


def factor_contribution(value: float, weight: float, direction: str) -> float:
    """Signed contribution of a single factor to the raw score sum."""
    magnitude = value * weight
    return -magnitude if direction == "negative" else magnitude


def compute_score(
    factors: Iterable,
    overrides: Mapping[str, float] | None = None,
) -> int:
    """Return an integer 0-100 score for the given factors.

    Pure function: no I/O, no database. ``overrides`` maps factor name -> new
    value (0.0-1.0) and is applied on top of the stored factor values, which is
    exactly what the ``/whatif`` endpoint needs.
    """
    overrides = overrides or {}
    raw_sum = 0.0
    pos_weight = 0.0
    neg_weight = 0.0

    for factor in factors:
        f = _factor_dict(factor)
        weight = float(f["weight"])
        value = overrides.get(f["name"], f["value"])
        value = max(0.0, min(1.0, float(value)))
        raw_sum += factor_contribution(value, weight, f["direction"])
        if f["direction"] == "negative":
            neg_weight += weight
        else:
            pos_weight += weight

    span = pos_weight + neg_weight
    if span == 0:
        return 50

    normalized = (raw_sum + neg_weight) / span * 100.0
    return int(round(max(0.0, min(100.0, normalized))))


def decide(score: int) -> str:
    """Map a score to a decision band.

    Thresholds (per the spec): <40 rejected, 40-70 review, >70 approved.
    """
    if score < 40:
        return "rejected"
    if score <= 70:
        return "review"
    return "approved"
