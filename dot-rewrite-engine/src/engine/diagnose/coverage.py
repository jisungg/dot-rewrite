"""Coverage score per topic.

Components: note count, avg note depth (section count + token count),
temporal repetition (distinct dates), internal cluster density, vocab richness.
"""
from __future__ import annotations

import math

from ..models import NoteRecord, TopicCluster


def score(topic: TopicCluster, notes_by_id: dict[str, NoteRecord], internal_density: float) -> float:
    members = [notes_by_id[nid] for nid in topic.note_ids if nid in notes_by_id]
    if not members:
        return 0.0

    n = len(members)
    avg_depth = sum(len(m.sections) + math.log1p(len(m.tokens)) for m in members) / n
    dates = {m.created_at.date() for m in members}
    temporal = min(1.0, len(dates) / 5.0)
    vocab = {t for m in members for t in m.tokens}
    richness = min(1.0, len(vocab) / (n * 40.0)) if n else 0.0

    raw = (
        0.25 * min(1.0, n / 8.0)
        + 0.25 * min(1.0, avg_depth / 15.0)
        + 0.20 * temporal
        + 0.15 * min(1.0, internal_density)
        + 0.15 * richness
    )
    return float(raw)
