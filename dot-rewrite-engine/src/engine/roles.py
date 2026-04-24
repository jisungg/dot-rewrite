"""Rule-based note role classifier.

Labels each note by dominant structure + cue words so downstream similarity
and diagnostics can weight notes differently (definition != lecture dump).
Purely heuristic — no ML. Outputs role + confidence.
"""
from __future__ import annotations

import re

from .models import NoteRecord, NoteRole, SectionKind

_Q = re.compile(r"\?\s*$|^(why|what|how|when|where|which|does|is|are)\b", re.IGNORECASE)
_COMPARE = re.compile(r"\b(vs\.?|versus|compared to|difference between|pros and cons)\b", re.IGNORECASE)
_EXAMPLE_CUE = re.compile(r"\b(example|e\.g\.|for instance|ex:)\b", re.IGNORECASE)
_DERIV = re.compile(r"\b(therefore|hence|thus|=>|⇒|proof|derivation|substitut\w*)\b", re.IGNORECASE)
_SUMMARY = re.compile(r"\b(summary|tl;?dr|recap|in short|overview)\b", re.IGNORECASE)
_REVIEW = re.compile(r"\b(review|flashcard|revise|practice|exam prep)\b", re.IGNORECASE)
_DEF_PATTERN = re.compile(r"^\s*[\w\- ]{1,40}\s*(:|—|-)\s+\S", re.MULTILINE)


def _length_class(text: str, sections: list) -> str:
    wc = len(text.split())
    if wc < 20:
        return "fragment"
    if wc < 120:
        return "short"
    if wc < 600:
        return "medium"
    return "long"


def _score_role(note: NoteRecord) -> dict[NoteRole, float]:
    text = note.raw_text or ""
    scores: dict[NoteRole, float] = {r: 0.0 for r in NoteRole}

    if len(text.split()) < 8:
        scores[NoteRole.FRAGMENT] += 1.5

    title = note.title or ""
    if _Q.search(title) or text.strip().endswith("?"):
        scores[NoteRole.QUESTION] += 1.2
    if _COMPARE.search(text) or _COMPARE.search(title):
        scores[NoteRole.COMPARISON] += 1.0
    if _EXAMPLE_CUE.search(text):
        scores[NoteRole.EXAMPLE] += 0.8
    if _DERIV.search(text):
        scores[NoteRole.DERIVATION] += 0.9
    if _SUMMARY.search(text) or _SUMMARY.search(title):
        scores[NoteRole.SUMMARY] += 0.8
    if _REVIEW.search(text) or _REVIEW.search(title):
        scores[NoteRole.REVIEW] += 0.8

    def_lines = len(_DEF_PATTERN.findall(text))
    if def_lines >= 2:
        scores[NoteRole.DEFINITION] += 1.0 + 0.1 * def_lines

    definition_sections = sum(1 for s in note.sections if s.kind == SectionKind.DEFINITION)
    if definition_sections >= 1:
        scores[NoteRole.DEFINITION] += 0.4 * definition_sections

    example_sections = sum(1 for s in note.sections if s.kind == SectionKind.EXAMPLE)
    if example_sections:
        scores[NoteRole.EXAMPLE] += 0.3 * example_sections

    wc = len(text.split())
    if wc >= 500 and len(note.sections) >= 6:
        scores[NoteRole.LECTURE_DUMP] += 1.0 + min(1.5, wc / 1000)

    return scores


def classify(note: NoteRecord) -> tuple[NoteRole, float]:
    scores = _score_role(note)
    role, top = max(scores.items(), key=lambda kv: kv[1])
    if top <= 0.3:
        return NoteRole.UNCLASSIFIED, 0.0
    second = sorted(scores.values(), reverse=True)[1] if len(scores) > 1 else 0.0
    conf = min(1.0, max(0.0, (top - second) / max(top, 1e-6)))
    return role, float(conf)


# role-aware weights for similarity + diagnostics
ROLE_WEIGHTS: dict[NoteRole, dict[str, float]] = {
    NoteRole.DEFINITION:   {"graph": 1.2, "prereq_source": 1.4, "coverage": 1.1},
    NoteRole.EXAMPLE:      {"graph": 1.0, "prereq_source": 0.6, "coverage": 0.9},
    NoteRole.DERIVATION:   {"graph": 1.0, "prereq_source": 0.8, "coverage": 1.0},
    NoteRole.SUMMARY:      {"graph": 0.8, "prereq_source": 1.1, "coverage": 1.2},
    NoteRole.QUESTION:     {"graph": 0.6, "prereq_source": 0.4, "coverage": 0.4},
    NoteRole.COMPARISON:   {"graph": 1.1, "prereq_source": 0.8, "coverage": 1.0},
    NoteRole.REVIEW:       {"graph": 0.7, "prereq_source": 0.6, "coverage": 1.1},
    NoteRole.LECTURE_DUMP: {"graph": 0.9, "prereq_source": 0.9, "coverage": 1.0},
    NoteRole.FRAGMENT:     {"graph": 0.4, "prereq_source": 0.2, "coverage": 0.3},
    NoteRole.UNCLASSIFIED: {"graph": 1.0, "prereq_source": 1.0, "coverage": 1.0},
}


def apply(notes: list[NoteRecord]) -> None:
    for n in notes:
        role, conf = classify(n)
        n.role = role
        n.role_confidence = conf
        n.length_class = _length_class(n.raw_text or "", n.sections)
