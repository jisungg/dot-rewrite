"""Phrase overlap similarity: weighted Jaccard over detected multi-word phrases."""
from __future__ import annotations


def score(phrases_a: set[str], phrases_b: set[str]) -> float:
    if not phrases_a or not phrases_b:
        return 0.0
    inter = len(phrases_a & phrases_b)
    union = len(phrases_a | phrases_b)
    return inter / union if union else 0.0
