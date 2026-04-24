"""Persistent topic identity across runs.

Aligns newly-detected clusters to prior clusters using three signals:
  - note-set overlap (Jaccard)
  - central-note overlap (the top-centrality members)
  - term-signature overlap (core + supporting terms)

Picks best match above a threshold; otherwise mints a fresh stable_id. This
keeps "photosynthesis" stable across runs instead of re-labelling it every time.
"""
from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass

from ..models import TopicCluster, TopicSignature


@dataclass
class PriorTopic:
    stable_id: str
    note_ids: list[str]
    central_note_ids: list[str]
    core_terms: list[str]


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def align(
    new_topics: list[TopicCluster],
    signatures: list[TopicSignature],
    priors: list[PriorTopic],
    threshold: float = 0.35,
) -> dict[str, str]:
    """Returns map new_topic.id -> stable_id."""
    result: dict[str, str] = {}
    used_prior: set[str] = set()
    sig_by_topic = {s.topic_id: s for s in signatures}

    scored: list[tuple[float, str, str]] = []  # (score, new_id, prior_stable_id)
    for t in new_topics:
        new_notes = set(t.note_ids)
        sig = sig_by_topic.get(t.id)
        new_core = set(sig.core_terms) if sig else set()
        new_central = set(sig.central_note_ids) if sig else set()
        for p in priors:
            s = (
                0.5 * _jaccard(new_notes, set(p.note_ids))
                + 0.25 * _jaccard(new_central, set(p.central_note_ids))
                + 0.25 * _jaccard(new_core, set(p.core_terms))
            )
            if s >= threshold:
                scored.append((s, t.id, p.stable_id))

    scored.sort(reverse=True)
    for s, new_id, prior_id in scored:
        if new_id in result or prior_id in used_prior:
            continue
        result[new_id] = prior_id
        used_prior.add(prior_id)

    for t in new_topics:
        if t.id not in result:
            result[t.id] = str(uuid.uuid4())

    for t in new_topics:
        t.stable_id = result[t.id]
    return result


def term_signature_hash(terms: list[str]) -> str:
    h = hashlib.sha1()
    for t in sorted(set(terms)):
        h.update(t.encode("utf-8"))
        h.update(b"\0")
    return h.hexdigest()[:12]
