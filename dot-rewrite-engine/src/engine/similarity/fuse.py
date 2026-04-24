"""Fuse similarity components into one weighted edge score."""
from __future__ import annotations

from ..config import FusionWeights
from ..models import SimilarityEdge, EdgeKind


def fuse(
    src: str,
    dst: str,
    *,
    lexical: float,
    phrase: float,
    structural: float,
    neighborhood: float,
    recency: float,
    weights: FusionWeights,
) -> SimilarityEdge:
    w = weights
    score = (
        w.lexical * lexical
        + w.phrase * phrase
        + w.structural * structural
        + w.neighborhood * neighborhood
        + w.recency * recency
    )
    return SimilarityEdge(
        src=src,
        dst=dst,
        weight=score,
        kind=EdgeKind.SIMILARITY,
        components={
            "lexical": lexical,
            "phrase": phrase,
            "structural": structural,
            "neighborhood": neighborhood,
            "recency": recency,
        },
    )
