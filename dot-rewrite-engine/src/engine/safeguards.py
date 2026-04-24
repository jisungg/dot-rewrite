"""Failure-mode safeguards. Detect messy input + degrade gracefully.

Flags emitted are informational; callers adjust behavior (looser clustering,
suppressed diagnostics) in response.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from .models import NoteRecord, NoteRole


@dataclass
class SpaceHealth:
    flags: list[str] = field(default_factory=list)
    note_count: int = 0
    token_count: int = 0
    giant_note_id: str | None = None
    dominant_role: str | None = None
    repetitive_score: float = 0.0   # 0 unique .. 1 perfectly repeated
    mixed_classes_score: float = 0.0  # 0 one class .. 1 many


def audit(notes: list[NoteRecord]) -> SpaceHealth:
    h = SpaceHealth(note_count=len(notes))
    if not notes:
        h.flags.append("empty_space")
        return h

    lengths = [max(1, len(n.tokens)) for n in notes]
    h.token_count = sum(lengths)

    if len(notes) < 4:
        h.flags.append("sparse_space")

    # one giant note
    if max(lengths) > 5 * (sum(lengths) / len(lengths)):
        idx = lengths.index(max(lengths))
        h.giant_note_id = notes[idx].id
        h.flags.append("one_giant_note")

    # role dominance
    roles = Counter((n.role.value if n.role else NoteRole.UNCLASSIFIED.value) for n in notes)
    dom_role, dom_count = roles.most_common(1)[0]
    h.dominant_role = dom_role
    if dom_count / len(notes) > 0.8 and dom_role in {NoteRole.DEFINITION.value, NoteRole.FRAGMENT.value}:
        h.flags.append(f"dominant_role:{dom_role}")

    # repetitive content: high average pairwise token Jaccard on a sample
    sample = notes[:20]
    if len(sample) >= 4:
        total = 0.0
        count = 0
        for i in range(len(sample)):
            for j in range(i + 1, len(sample)):
                a = set(sample[i].tokens)
                b = set(sample[j].tokens)
                if not a or not b:
                    continue
                total += len(a & b) / len(a | b)
                count += 1
        avg = total / count if count else 0.0
        h.repetitive_score = avg
        if avg > 0.55:
            h.flags.append("repetitive_space")

    # mixed classes heuristic: tag diversity
    tag_sets = [set(n.tags) for n in notes if n.tags]
    if tag_sets:
        all_tags: set[str] = set()
        for s in tag_sets:
            all_tags |= s
        h.mixed_classes_score = min(1.0, len(all_tags) / max(1.0, len(notes) * 0.5))
        if h.mixed_classes_score > 0.7:
            h.flags.append("mixed_classes")

    glossary_like = sum(1 for n in notes if n.role == NoteRole.DEFINITION and len(n.tokens) < 60)
    if glossary_like / max(1, len(notes)) > 0.6:
        h.flags.append("glossary_heavy")

    return h
