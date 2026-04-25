"""spaCy-driven concept mention extraction over note spans.

For each NoteSpan we tokenize, lemmatize, tag part-of-speech, and pull
named entities. Outputs `ConceptMention` rows keyed by a normalized
`concept_key` (lowercased, NFKC-normalized lemma, alnum-stripped at
boundaries) so cross-note dedupe behaves predictably.

Spans of kind CODE are skipped (code identifiers explode the concept
space without giving useful semantics). MATH spans are kept; their text
often contains real concept names ("eigenvalue", "lambda").

Fail-soft: if spaCy is unavailable, returns an empty list. Logs once.
"""
from __future__ import annotations

import logging
import re
import unicodedata
from functools import lru_cache

from ..models import ConceptMention, NoteSpan, SpanKind

log = logging.getLogger("engine.extract.concept_extract")

_KEY_BOUND = re.compile(r"^[^a-z0-9]+|[^a-z0-9]+$")
_KEY_INNER = re.compile(r"\s+")
_NOISY_LEMMAS = {
    "thing", "stuff", "way", "kind", "case", "lot", "bit",
    "example", "note", "section", "summary", "definition",
    "be", "do", "have", "go", "make", "take", "say", "see",
}
_KEEP_POS = {"NOUN", "PROPN"}


def normalize_concept_key(lemma: str) -> str:
    if not lemma:
        return ""
    nf = unicodedata.normalize("NFKC", lemma).lower()
    nf = _KEY_INNER.sub(" ", nf).strip()
    nf = _KEY_BOUND.sub("", nf)
    return nf


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
        log.warning("spacy en_core_web_sm load failed: %s — concept extraction disabled", e)
        return None


def _is_useful(token, lemma_lc: str) -> bool:
    if len(lemma_lc) < 3:
        return False
    if lemma_lc in _NOISY_LEMMAS:
        return False
    if token.is_stop or token.is_punct or token.is_space:
        return False
    return True


def _noun_phrases(doc) -> list[tuple[str, str, str, bool, str | None]]:
    """Return (surface, lemma, pos, is_entity, ent_label) per useful noun-phrase head + entity."""
    seen: set[tuple[str, str]] = set()
    out: list[tuple[str, str, str, bool, str | None]] = []

    for ent in doc.ents:
        surface = ent.text.strip()
        if not surface:
            continue
        lemma = ent.lemma_.strip() or surface
        key = (lemma.lower(), ent.label_ or "")
        if key in seen:
            continue
        seen.add(key)
        out.append((surface, lemma, "ENT", True, ent.label_ or None))

    try:
        chunks = list(doc.noun_chunks)
    except Exception:
        chunks = []
    for chunk in chunks:
        head = chunk.root
        if not head.lemma_:
            continue
        if head.pos_ not in _KEEP_POS:
            continue
        lemma_lc = head.lemma_.lower()
        if not _is_useful(head, lemma_lc):
            continue
        # Prefer the multi-token chunk when it adds modifier signal.
        surface = chunk.text.strip() or head.text
        lemma = chunk.lemma_.strip() or head.lemma_
        key = (lemma.lower(), head.pos_)
        if key in seen:
            continue
        seen.add(key)
        out.append((surface, lemma, head.pos_, False, None))

    # Single-token nouns / propers that the chunker missed (math symbols etc.).
    for tok in doc:
        if tok.pos_ not in _KEEP_POS:
            continue
        lemma_lc = (tok.lemma_ or "").lower()
        if not _is_useful(tok, lemma_lc):
            continue
        key = (lemma_lc, tok.pos_)
        if key in seen:
            continue
        seen.add(key)
        out.append((tok.text, tok.lemma_, tok.pos_, False, None))

    return out


def extract_for_spans(
    spans: list[NoteSpan],
) -> list[ConceptMention]:
    """Run spaCy across each non-code span, emit ConceptMention rows."""
    nlp = _nlp()
    if nlp is None or not spans:
        return []

    mentions: list[ConceptMention] = []

    # Batch using nlp.pipe; carry index so we can map results back to spans.
    payload: list[tuple[NoteSpan, str]] = []
    for s in spans:
        if s.kind == SpanKind.CODE:
            continue
        text = (s.text or "").strip()
        if not text:
            continue
        payload.append((s, text))

    if not payload:
        return []

    docs = nlp.pipe([t for _, t in payload], batch_size=32)
    for (span, _), doc in zip(payload, docs):
        per_span_seen: set[str] = set()
        for surface, lemma, pos, is_ent, ent_label in _noun_phrases(doc):
            key = normalize_concept_key(lemma)
            if not key:
                continue
            if key in per_span_seen:
                continue
            per_span_seen.add(key)
            mentions.append(
                ConceptMention(
                    space_id=span.space_id,
                    note_id=span.note_id,
                    span_id=span.id,
                    surface=surface[:200],
                    lemma=lemma[:200],
                    concept_key=key[:240],
                    pos=pos,
                    is_entity=is_ent,
                    ent_label=ent_label,
                )
            )

    return mentions
