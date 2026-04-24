"""Topic signatures — aggressive higher-level compression.

Topic signature = small, stable set of high-confidence terms + central notes +
role mix. Space-level diagnostics derive from topic signatures, NOT raw notes.
Keeps top-level outputs clean even when note cloud is noisy.
"""
from __future__ import annotations

from collections import Counter

from ..models import NoteRecord, NoteRole, TopicCluster, TopicSignature
from ..topics.identity import term_signature_hash


def _role_mix(notes: list[NoteRecord]) -> dict[str, float]:
    c: Counter[str] = Counter()
    for n in notes:
        r = (n.role.value if n.role else NoteRole.UNCLASSIFIED.value)
        c[r] += 1
    total = sum(c.values()) or 1
    return {k: v / total for k, v in c.items()}


def build(
    topic: TopicCluster,
    notes_by_id: dict[str, NoteRecord],
    central_note_ids: list[str],
    discriminators: list[str] | None = None,
) -> TopicSignature:
    members = [notes_by_id[nid] for nid in topic.note_ids if nid in notes_by_id]

    # core terms: high DF inside topic, but also prefer discriminators
    df: Counter[str] = Counter()
    for m in members:
        df.update(set(m.tokens))
    # keep terms present in at least 30% of topic members (stability)
    min_df = max(1, int(0.3 * len(members)))
    stable = [t for t, c in df.items() if c >= min_df]

    if discriminators:
        core = [t for t in discriminators if t in df][:8]
        if len(core) < 5:
            # backfill from stable high-DF terms not already in core
            core.extend([t for t, _ in df.most_common() if t not in core][: 8 - len(core)])
    else:
        core = [t for t, _ in df.most_common(8)]

    supporting = [t for t, _ in df.most_common(25) if t not in core][:15]

    sig = TopicSignature(
        topic_id=topic.id,
        stable_id=topic.stable_id or topic.id,
        core_terms=core,
        supporting_terms=supporting,
        central_note_ids=list(central_note_ids),
        role_mix=_role_mix(members),
        term_signature_hash=term_signature_hash(core + supporting),
    )
    topic.role_mix = sig.role_mix
    return sig
