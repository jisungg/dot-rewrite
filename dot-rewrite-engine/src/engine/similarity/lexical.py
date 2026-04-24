"""Lexical cosine similarity on TF-IDF matrix."""
from __future__ import annotations

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from ..represent.lexical import LexicalSpace


def pairwise(space: LexicalSpace) -> np.ndarray:
    return cosine_similarity(space.tfidf, dense_output=True)


def row(space: LexicalSpace, idx: int) -> np.ndarray:
    sims = cosine_similarity(space.tfidf[idx], space.tfidf, dense_output=True).ravel()
    sims[idx] = 0.0
    return sims
