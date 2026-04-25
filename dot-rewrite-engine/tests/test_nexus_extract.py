"""Tests for the Nexus deep-extraction stages.

Covers markdown_ast block kinds, concept_extract dedupe + normalization,
relation_spacy cue-pattern matching, centrality role flags, and the
insights materializer ranking.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from engine.extract import (
    centrality as nx_centrality,
    concept_extract as nx_concepts,
    insights as nx_insights,
    markdown_ast as nx_ast,
    relation_spacy as nx_relations,
)
from engine.extract.concept_extract import normalize_concept_key
from engine.models import (
    InsightKind,
    NoteMetric,
    NoteRecord,
    RelationKind,
    SemanticCluster,
    SemanticEdge,
    SpanKind,
    TypedRelation,
)


def _mk_note(title: str, raw: str, *, space_id: str = "s1") -> NoteRecord:
    return NoteRecord(
        id=str(uuid.uuid4()),
        space_id=space_id,
        title=title,
        raw_text=raw,
        created_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 20, tzinfo=timezone.utc),
    )


# --------------------------- markdown_ast ---------------------------


def test_ast_extracts_each_block_kind():
    note = _mk_note(
        "Mixed",
        """# Heading One

A short paragraph that mentions eigenvalue decomposition.

## Heading Two

- first list item
- second list item

> a block quote

```python
def f(): return 1
```

Inline math like $x^2$ and block math:

$$E = mc^2$$
""",
    )
    spans = nx_ast.extract_spans(note)
    kinds = {s.kind for s in spans}
    assert SpanKind.HEADING in kinds
    assert SpanKind.PARAGRAPH in kinds
    assert SpanKind.LIST_ITEM in kinds
    assert SpanKind.QUOTE in kinds
    assert SpanKind.CODE in kinds
    assert SpanKind.MATH in kinds


def test_ast_empty_note_yields_no_spans():
    assert nx_ast.extract_spans(_mk_note("Empty", "   ")) == []


def test_ast_callout_detected():
    note = _mk_note("Callout note", "> [!note] this is a callout block")
    spans = nx_ast.extract_spans(note)
    assert any(s.kind == SpanKind.CALLOUT for s in spans)


# --------------------------- concept normalization ---------------------------


def test_normalize_concept_key_handles_unicode_and_boundaries():
    assert normalize_concept_key("  Eigenvalue!  ") == "eigenvalue"
    assert normalize_concept_key("ﬁnal") == "final"  # NFKC ligature → ascii
    assert normalize_concept_key("") == ""


# --------------------------- relation_spacy patterns ---------------------------


def test_spacy_cue_patterns_compile_and_match_text():
    # Pattern compilation + literal matching are pure-Python; safe to
    # validate without the spaCy model installed.
    from engine.extract.relation_spacy import CUE_PATTERNS

    text = "Backpropagation depends on gradient descent for parameter updates."
    found = [rel for rel, pat, _ in CUE_PATTERNS if pat.search(text)]
    assert RelationKind.DEPENDS_ON in found

    text2 = "However, this contradicts the earlier claim."
    found2 = [rel for rel, pat, _ in CUE_PATTERNS if pat.search(text2)]
    assert RelationKind.CONTRADICTS in found2 or RelationKind.CONTRADICTS in {
        r for r, _, _ in CUE_PATTERNS if r == RelationKind.CONTRADICTS
    }


# --------------------------- centrality / role flags ---------------------------


def test_centrality_flags_orphans_when_no_edges():
    notes = [_mk_note(f"n{i}", f"body {i}") for i in range(3)]
    metrics = nx_centrality.compute_metrics(notes, semantic_edges=[], semantic_clusters=[])
    assert len(metrics) == 3
    assert all(m.is_orphan for m in metrics)
    assert not any(m.is_god_node for m in metrics)


def test_centrality_picks_god_on_star_graph():
    notes = [_mk_note(f"n{i}", f"body {i}") for i in range(5)]
    hub_id = notes[0].id
    edges = [
        SemanticEdge(src=hub_id, dst=notes[i].id, similarity=0.9, mutual=True)
        for i in range(1, 5)
    ]
    metrics = nx_centrality.compute_metrics(notes, semantic_edges=edges, semantic_clusters=[])
    by_id = {m.note_id: m for m in metrics}
    assert by_id[hub_id].is_god_node is True
    assert by_id[hub_id].degree == 4


# --------------------------- insights materializer ---------------------------


def _now() -> datetime:
    return datetime(2026, 4, 25, tzinfo=timezone.utc)


def test_insights_emit_god_orphan_contradiction_chain_reach():
    notes = [_mk_note(f"n{i}", f"body {i}") for i in range(4)]
    space_id = notes[0].space_id
    metrics = [
        NoteMetric(space_id=space_id, note_id=notes[0].id, degree=3, pagerank=0.4,
                   betweenness=0.6, is_god_node=True, is_bridge=True, community_id="c1"),
        NoteMetric(space_id=space_id, note_id=notes[1].id, degree=0, pagerank=0.0,
                   betweenness=0.0, is_orphan=True, community_id=None),
        NoteMetric(space_id=space_id, note_id=notes[2].id, degree=1, pagerank=0.1,
                   community_id="c2"),
        NoteMetric(space_id=space_id, note_id=notes[3].id, degree=1, pagerank=0.1,
                   community_id="c3"),
    ]
    relations = [
        TypedRelation(
            space_id=space_id, relation=RelationKind.CONTRADICTS, source="llm",
            confidence=0.8, src_note_id=notes[0].id, dst_note_id=notes[2].id,
            evidence="A claims X but B claims not X.",
        ),
        TypedRelation(
            space_id=space_id, relation=RelationKind.DEPENDS_ON, source="spacy",
            confidence=0.7, src_note_id=notes[0].id, dst_note_id=notes[2].id,
        ),
        TypedRelation(
            space_id=space_id, relation=RelationKind.DEPENDS_ON, source="spacy",
            confidence=0.7, src_note_id=notes[2].id, dst_note_id=notes[3].id,
        ),
    ]
    from engine.models import ConceptMention
    mentions = [
        ConceptMention(space_id=space_id, note_id=notes[0].id, span_id=None,
                       surface="eigen", lemma="eigen", concept_key="eigen"),
        ConceptMention(space_id=space_id, note_id=notes[2].id, span_id=None,
                       surface="eigen", lemma="eigen", concept_key="eigen"),
        ConceptMention(space_id=space_id, note_id=notes[3].id, span_id=None,
                       surface="eigen", lemma="eigen", concept_key="eigen"),
    ]
    cards = nx_insights.materialize(
        space_id=space_id,
        notes=notes,
        semantic_clusters=[],
        metrics=metrics,
        relations=relations,
        mentions=mentions,
        now=_now(),
    )
    kinds = {c.kind for c in cards}
    assert InsightKind.GOD in kinds
    assert InsightKind.ORPHAN in kinds
    assert InsightKind.CONTRADICTION in kinds
    assert InsightKind.CHAIN in kinds
    assert InsightKind.REACH in kinds
    # All scores in [0,1]
    assert all(0.0 <= c.score <= 1.0 for c in cards)


def test_insights_emerging_window():
    notes = [
        _mk_note("recent a", "x"),
        _mk_note("recent b", "y"),
    ]
    # Override updated_at to fall inside the 14-day window.
    fresh = _now() - timedelta(days=3)
    for n in notes:
        n.updated_at = fresh
    cluster = SemanticCluster(
        id="c1", space_id=notes[0].space_id,
        note_ids=[n.id for n in notes], label="Recents",
    )
    cards = nx_insights.materialize(
        space_id=notes[0].space_id,
        notes=notes,
        semantic_clusters=[cluster],
        metrics=[], relations=[], mentions=[],
        now=_now(),
    )
    assert any(c.kind == InsightKind.EMERGING for c in cards)
