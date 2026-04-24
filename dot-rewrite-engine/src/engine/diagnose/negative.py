"""Negative evidence signals: mismatch / divergence detection.

1. Lexical-close / structural-far pairs: notes with high TF-IDF cosine but low
   heading-overlap. Often 'talks about the same words, actually different topic.'
2. Phrase-share / example-diverge: two notes share phrases but their EXAMPLE
   sections point to different concrete cases.
3. Topic vocabulary overlap / foundational mismatch: topics whose token clouds
   overlap but whose foundational central notes are disjoint.
"""
from __future__ import annotations

from ..models import NoteRecord, SectionKind, SimilarityEdge, EdgeKind


def lexical_structural_mismatch(
    notes: list[NoteRecord],
    fused_map: dict[tuple[int, int], SimilarityEdge],
    min_lexical: float = 0.35,
    max_structural: float = 0.05,
) -> list[SimilarityEdge]:
    out: list[SimilarityEdge] = []
    for (i, j), edge in fused_map.items():
        lex = edge.components.get("lexical", 0.0)
        struct = edge.components.get("structural", 0.0)
        if lex >= min_lexical and struct <= max_structural:
            out.append(SimilarityEdge(
                src=notes[i].id, dst=notes[j].id,
                weight=lex - struct,
                kind=EdgeKind.MISMATCH,
                components={"lexical": lex, "structural": struct, "kind": 1.0},
            ))
    return out


def phrase_example_divergence(
    notes: list[NoteRecord],
    fused_map: dict[tuple[int, int], SimilarityEdge],
    min_phrase: float = 0.25,
) -> list[SimilarityEdge]:
    def _example_terms(n: NoteRecord) -> set[str]:
        out: set[str] = set()
        for s in n.sections:
            if s.kind == SectionKind.EXAMPLE:
                out.update(s.tokens)
        return out

    result: list[SimilarityEdge] = []
    for (i, j), edge in fused_map.items():
        ph = edge.components.get("phrase", 0.0)
        if ph < min_phrase:
            continue
        a_ex, b_ex = _example_terms(notes[i]), _example_terms(notes[j])
        if not a_ex or not b_ex:
            continue
        inter = len(a_ex & b_ex)
        union = len(a_ex | b_ex)
        ex_jaccard = inter / union if union else 0.0
        if ex_jaccard < 0.1:
            result.append(SimilarityEdge(
                src=notes[i].id, dst=notes[j].id,
                weight=ph - ex_jaccard,
                kind=EdgeKind.MISMATCH,
                components={"phrase": ph, "example_overlap": ex_jaccard, "kind": 2.0},
            ))
    return result
