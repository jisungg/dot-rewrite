"""Turn a list[NoteRecord] into dense vectors.

Strategy: encode each WeightedSection separately, then take a
section-weight-weighted mean. Title and definition sections thus pull the
vector harder than free body text — mirrors the `SectionWeights` already
used by the lexical pipeline.

Empty notes fall back to their raw_text. Output vectors are L2-normalized
so cosine == dot product.

Embeddings are content-hashed. The `encode_notes` helper accepts a
`cached` dict of existing embeddings and only encodes notes whose
`content_hash` changed — a fast path for incremental re-runs.
"""
from __future__ import annotations

import hashlib
import logging
from typing import Iterable

import numpy as np

from ..ingest import markdown as md
from ..models import NoteEmbedding, NoteRecord
from . import model as model_mod

log = logging.getLogger("engine.embed.encode")


def content_hash(note: NoteRecord) -> str:
    h = hashlib.sha1()
    h.update(model_mod.model_name().encode("utf-8"))
    h.update(b"\x00")
    h.update(note.title.encode("utf-8"))
    h.update(b"\x00")
    h.update(note.raw_text.encode("utf-8"))
    return h.hexdigest()


def _section_texts_and_weights(note: NoteRecord) -> tuple[list[str], list[float]]:
    texts: list[str] = []
    weights: list[float] = []
    if note.title.strip():
        texts.append(md.clean(note.title).strip() or note.title)
        weights.append(3.0)
    for s in note.sections:
        t = (s.text or "").strip()
        if not t:
            continue
        texts.append(t)
        weights.append(max(0.1, float(s.weight)))
    if not texts:
        cleaned = md.clean(note.raw_text).strip()
        if cleaned:
            texts.append(cleaned)
            weights.append(1.0)
    return texts, weights


def _l2(vec: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(vec))
    if n < 1e-12:
        return vec
    return vec / n


def encode_notes(
    notes: Iterable[NoteRecord],
    cached: dict[str, NoteEmbedding] | None = None,
) -> dict[str, NoteEmbedding]:
    """Return a dict note_id -> NoteEmbedding, or {} if the model is unavailable."""
    notes = list(notes)
    if not notes:
        return {}
    mdl = model_mod.get()
    if mdl is None:
        log.info("embeddings disabled or unavailable; skipping semantic stage")
        return {}

    cached = cached or {}

    model_id = model_mod.model_name()
    dim = model_mod.embedding_dim()

    fresh: dict[str, NoteEmbedding] = {}
    batch_texts: list[str] = []
    batch_owners: list[tuple[int, str, float]] = []  # (note_idx, note_id, weight)
    note_segment_counts: list[int] = []

    prepared: list[tuple[NoteRecord, str, list[str], list[float]]] = []
    for n in notes:
        h = content_hash(n)
        existing = cached.get(n.id)
        if existing and existing.content_hash == h and existing.model == model_id:
            fresh[n.id] = existing
            note_segment_counts.append(0)
            prepared.append((n, h, [], []))
            continue
        texts, weights = _section_texts_and_weights(n)
        if not texts:
            note_segment_counts.append(0)
            prepared.append((n, h, [], []))
            continue
        for t, w in zip(texts, weights):
            batch_texts.append(t[:2000])  # cap per-segment length
            batch_owners.append((len(prepared), n.id, w))
        note_segment_counts.append(len(texts))
        prepared.append((n, h, texts, weights))

    if not batch_texts:
        return fresh

    vectors = mdl.encode(
        batch_texts,
        batch_size=32,
        normalize_embeddings=True,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    vectors = np.asarray(vectors, dtype=np.float32)

    cursor = 0
    for i, (n, h, texts, weights) in enumerate(prepared):
        k = note_segment_counts[i]
        if k == 0:
            continue
        segs = vectors[cursor : cursor + k]
        cursor += k
        w = np.asarray(weights, dtype=np.float32).reshape(-1, 1)
        mean = (segs * w).sum(axis=0) / max(1e-6, float(w.sum()))
        mean = _l2(mean.astype(np.float32))
        fresh[n.id] = NoteEmbedding(
            space_id=n.space_id,
            note_id=n.id,
            model=model_id,
            dim=int(mean.shape[0]) if dim == 0 else dim,
            vector=mean.tolist(),
            content_hash=h,
        )

    return fresh


def as_matrix(
    order: list[str], embeddings: dict[str, NoteEmbedding]
) -> tuple[np.ndarray, list[str]]:
    """Return (matrix, kept_ids) aligning note ids to row indices.

    Notes without an embedding (e.g. empty content) are dropped so callers
    never have to check for None vectors.
    """
    rows: list[np.ndarray] = []
    kept: list[str] = []
    for nid in order:
        emb = embeddings.get(nid)
        if emb is None:
            continue
        rows.append(np.asarray(emb.vector, dtype=np.float32))
        kept.append(nid)
    if not rows:
        return np.zeros((0, 0), dtype=np.float32), []
    return np.vstack(rows), kept
