"""Concept canonicalization: collapse variants of the same term.

Rules (no ML):
  - trivial plural -> singular (s / es / ies)
  - lowercase already done by normalize
  - reordered multi-word phrases (tokens sorted) -> canonical ordering
  - acronym <-> full form pairs via simple co-occurrence (acronym in parens)
  - course aliases file (optional, not required now)

Returns a mapping: surface_token -> canonical_token. Apply after phrase mining
so 'neural_network' / 'neural_networks' / 'networks_neural' collapse.
"""
from __future__ import annotations

import re
from collections import Counter

from ..models import NoteRecord


_ACRONYM_INLINE = re.compile(r"\b([A-Za-z][A-Za-z\- ]{3,}?)\s*\(([A-Z]{2,6})\)")


def _singularize(tok: str) -> str:
    if len(tok) > 4 and tok.endswith("ies"):
        return tok[:-3] + "y"
    if len(tok) > 4 and tok.endswith("sses"):
        return tok[:-2]
    if len(tok) > 3 and tok.endswith("s") and not tok.endswith("ss"):
        return tok[:-1]
    return tok


def _canonical_phrase(tok: str) -> str:
    if "_" not in tok:
        return _singularize(tok)
    parts = [_singularize(p) for p in tok.split("_") if p]
    parts_sorted = sorted(parts)
    return "_".join(parts_sorted)


def build_mapping(notes: list[NoteRecord]) -> dict[str, str]:
    """Build canonical-term map across a space."""
    all_tokens: Counter[str] = Counter()
    for n in notes:
        all_tokens.update(n.tokens)

    mapping: dict[str, str] = {}
    # group by canonical form, pick the most common surface form as the printed label
    groups: dict[str, Counter] = {}
    for tok, cnt in all_tokens.items():
        canon = _canonical_phrase(tok)
        groups.setdefault(canon, Counter())[tok] = cnt
    for canon, surface_counter in groups.items():
        canonical_surface = surface_counter.most_common(1)[0][0]
        for tok in surface_counter:
            mapping[tok] = canonical_surface

    # acronym <-> full form from inline 'Full Form (ACR)' patterns
    for n in notes:
        for m in _ACRONYM_INLINE.finditer(n.raw_text or ""):
            full = m.group(1).strip().lower().replace(" ", "_")
            acr = m.group(2).lower()
            full_s = _singularize(full)
            acr_s = _singularize(acr)
            # pick whichever surface is more common as the target
            a = all_tokens.get(full_s, 0)
            b = all_tokens.get(acr_s, 0)
            target = full_s if a >= b else acr_s
            mapping[full_s] = target
            mapping[acr_s] = target

    return mapping


def apply(notes: list[NoteRecord], mapping: dict[str, str]) -> None:
    for n in notes:
        n.tokens = [mapping.get(t, t) for t in n.tokens]
        n.phrases = [mapping.get(t, t) for t in n.phrases]
        for s in n.sections:
            s.tokens = [mapping.get(t, t) for t in s.tokens]
