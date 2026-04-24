"""Lexical representation: TF-IDF (center), BM25 (retrieval-flavor), vocab stats.

TF-IDF cosine is the main symmetric note-to-note backbone. BM25 scores are kept
for retrieval-style probes and as a diagnostic signal (term saturation).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer


@dataclass
class LexicalSpace:
    vectorizer: TfidfVectorizer
    tfidf: csr_matrix              # (n_notes, n_terms)
    note_ids: list[str]
    vocab: list[str]
    doc_freq: np.ndarray           # per-term document frequency
    avg_len: float


def build_tfidf(note_ids: list[str], token_streams: list[list[str]]) -> LexicalSpace:
    docs = [" ".join(s) for s in token_streams]
    n = len(docs)
    # small / repetitive corpora: don't prune by max_df or nothing remains
    max_df = 1.0 if n < 10 else 0.95
    vec = TfidfVectorizer(
        token_pattern=r"(?u)\b[\w\-/]+\b",
        sublinear_tf=True,
        min_df=1,
        max_df=max_df,
        norm="l2",
    )
    tfidf = vec.fit_transform(docs)
    vocab = vec.get_feature_names_out().tolist()
    # doc frequency from binary presence
    binary = (tfidf > 0).astype(np.int8)
    df = np.asarray(binary.sum(axis=0)).ravel()
    lengths = np.array([len(s) for s in token_streams], dtype=np.float32)
    avg_len = float(lengths.mean()) if len(lengths) else 0.0
    return LexicalSpace(vec, tfidf, note_ids, vocab, df, avg_len)


def bm25_scores(
    space: LexicalSpace,
    query_tokens: list[str],
    k1: float = 1.5,
    b: float = 0.75,
) -> np.ndarray:
    """Score every note against a token query (retrieval-flavor probe)."""
    from rank_bm25 import BM25Okapi
    # rebuild per-call is acceptable here (small spaces, rare use)
    # Reconstruct corpus from TF-IDF is lossy; keep a token corpus cache upstream.
    raise NotImplementedError("Wire with cached token corpus in pipeline.runner")
