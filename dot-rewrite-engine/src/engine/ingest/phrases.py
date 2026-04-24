"""Multi-word phrase mining via PMI (gensim Phrases).

Two-pass: unigrams -> bigrams -> trigrams. Keeps course-specific compound terms
like "binary search tree" instead of collapsing to isolated words.
"""
from __future__ import annotations

from typing import Iterable


def mine_phrases(
    token_streams: Iterable[list[str]],
    min_count: int = 3,
    threshold: float = 8.0,
) -> list[list[str]]:
    from gensim.models.phrases import Phrases, Phraser

    streams = [list(s) for s in token_streams]
    bi = Phraser(Phrases(streams, min_count=min_count, threshold=threshold))
    bigram_streams = [bi[s] for s in streams]
    tri = Phraser(Phrases(bigram_streams, min_count=min_count, threshold=threshold))
    return [list(tri[s]) for s in bigram_streams]
