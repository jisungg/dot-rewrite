"""Progressive compression: note-level -> topic-level -> space-level."""
from __future__ import annotations

from collections import Counter

from ..models import NoteRecord, TopicCluster


def topic_keywords(notes: list[NoteRecord], top_k: int = 12) -> list[str]:
    c: Counter[str] = Counter()
    for n in notes:
        c.update(set(n.tokens))        # presence, not raw count
    return [t for t, _ in c.most_common(top_k)]


def topic_label(notes: list[NoteRecord]) -> str:
    for n in notes:
        for s in n.sections:
            if s.kind.value == "title" and s.text:
                return s.text[:80]
    return "untitled topic"


def finalize_topic(topic: TopicCluster, notes_by_id: dict[str, NoteRecord]) -> None:
    members = [notes_by_id[nid] for nid in topic.note_ids if nid in notes_by_id]
    topic.keywords = topic_keywords(members)
    topic.label = topic_label(members)
    topic.centroid_terms = topic.keywords[:5]
