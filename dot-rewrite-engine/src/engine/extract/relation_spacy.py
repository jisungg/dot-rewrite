"""Cheap typed-relation extraction via spaCy dependency patterns.

Produces note→note `TypedRelation` rows by matching cue patterns inside
note spans, then resolving the surface object/subject back to the most
likely target note via concept-key overlap.

Patterns supported (source='spacy'):

  RELATION       CUE PATTERNS
  -------------- -------------------------------------------------
  depends_on     "depends on", "requires", "needs", "presupposes"
  causes         "causes", "leads to", "results in", "produces"
  contradicts    "however", "but", "unlike", "contradicts"
  is_a           SVO with copula "is/are/was/were a/an" + noun
  defines        SVO with copula "is defined as" + noun
  exemplifies    "for example", "e.g.", "for instance"
  elaborates     "specifically", "in particular", "more precisely"
  part_of        "part of", "component of", "consists of"

Only emits a row when both endpoints can be resolved to distinct notes
in the same space. Confidence reflects pattern strength; floored at 0.5
on write.

Fail-soft: missing spaCy → empty list.
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from functools import lru_cache

from ..models import (
    ConceptMention,
    NoteRecord,
    NoteSpan,
    RelationKind,
    SpanKind,
    TypedRelation,
)
from .concept_extract import normalize_concept_key

log = logging.getLogger("engine.extract.relation_spacy")


CUE_PATTERNS: list[tuple[RelationKind, re.Pattern[str], float]] = [
    (RelationKind.DEPENDS_ON, re.compile(r"\b(depends on|requires|presupposes|relies on|builds on)\b", re.I), 0.75),
    (RelationKind.CAUSES,      re.compile(r"\b(causes?|caused|leads? to|results? in|produces?)\b", re.I), 0.7),
    (RelationKind.CONTRADICTS, re.compile(r"\b(contradicts?|refutes?|disproves?|unlike)\b", re.I), 0.7),
    (RelationKind.IS_A,        re.compile(r"\b(is|are|was|were)\s+(?:a|an|the)\s+\w+", re.I), 0.6),
    (RelationKind.DEFINES,     re.compile(r"\b(?:is|are)\s+defined\s+as\b", re.I), 0.8),
    (RelationKind.EXEMPLIFIES, re.compile(r"\b(for example|for instance|e\.g\.|such as)\b", re.I), 0.6),
    (RelationKind.ELABORATES,  re.compile(r"\b(specifically|in particular|more precisely|that is)\b", re.I), 0.55),
    (RelationKind.PART_OF,     re.compile(r"\b(part of|component of|consists of|made up of)\b", re.I), 0.7),
]


@lru_cache(maxsize=1)
def _nlp():
    try:
        import spacy
    except Exception as e:  # pragma: no cover
        log.warning("spacy import failed: %s", e)
        return None
    try:
        return spacy.load("en_core_web_sm")
    except Exception as e:
        log.warning("spacy en_core_web_sm load failed: %s — relation extraction disabled", e)
        return None


def _build_concept_index(
    notes: list[NoteRecord],
    mentions: list[ConceptMention],
) -> dict[str, dict[str, set[str]]]:
    """Map space_id -> concept_key -> set of note_ids that mention it."""
    space_ids = {n.id: n.space_id for n in notes}
    out: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for m in mentions:
        if m.note_id not in space_ids:
            continue
        if not m.concept_key:
            continue
        out[m.space_id][m.concept_key].add(m.note_id)
    return out


def _resolve_target(
    text_after: str,
    src_note_id: str,
    space_index: dict[str, set[str]],
) -> str | None:
    """Pick a target note by extracting noun-ish words from `text_after`
    and looking them up in the concept index.
    """
    nlp = _nlp()
    if nlp is None:
        return None
    if not text_after:
        return None
    doc = nlp(text_after[:240])
    candidates: list[str] = []
    for chunk in doc.noun_chunks:
        head = chunk.root
        if head.pos_ not in {"NOUN", "PROPN"}:
            continue
        key = normalize_concept_key(chunk.lemma_ or head.lemma_)
        if key:
            candidates.append(key)
    if not candidates:
        return None

    best: tuple[int, str | None] = (0, None)
    for key in candidates:
        notes = space_index.get(key)
        if not notes:
            continue
        for nid in notes:
            if nid == src_note_id:
                continue
            score = len(key.split())  # longer phrase wins
            if score > best[0]:
                best = (score, nid)
    return best[1]


def extract_relations(
    notes: list[NoteRecord],
    spans: list[NoteSpan],
    mentions: list[ConceptMention],
) -> list[TypedRelation]:
    nlp = _nlp()
    if nlp is None or not spans or not notes:
        return []

    index_by_space = _build_concept_index(notes, mentions)
    spans_by_note: dict[str, list[NoteSpan]] = defaultdict(list)
    for s in spans:
        if s.kind == SpanKind.CODE:
            continue
        spans_by_note[s.note_id].append(s)

    out: list[TypedRelation] = []
    seen: set[tuple[str, str, str, str]] = set()

    for note in notes:
        space_index = index_by_space.get(note.space_id, {})
        if not space_index:
            continue
        for span in spans_by_note.get(note.id, []):
            text = span.text
            if not text:
                continue
            for rel, pat, conf in CUE_PATTERNS:
                for m in pat.finditer(text):
                    cue_end = m.end()
                    text_after = text[cue_end : cue_end + 240]
                    if not text_after.strip():
                        continue
                    tgt = _resolve_target(text_after, note.id, space_index)
                    if not tgt:
                        continue
                    key = (note.space_id, note.id, tgt, rel.value)
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append(
                        TypedRelation(
                            space_id=note.space_id,
                            relation=rel,
                            source="spacy",
                            confidence=float(conf),
                            src_note_id=note.id,
                            dst_note_id=tgt,
                            evidence=text[max(0, m.start() - 20) : min(len(text), cue_end + 80)],
                        )
                    )

    return out
