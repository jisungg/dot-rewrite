"""Classify each note into one of M/S/C/P/H disciplines.

Strategy (cheap, deterministic, no extra API cost):

  1. Score each note by overlap of its tokens / phrases / cluster
     keywords against per-discipline lexicons.
  2. Combine with the parent semantic-cluster's keywords (already
     algorithmically extracted) so a "vector projection" note inside a
     cluster labeled "Linear Algebra" inherits the cluster signal.
  3. Top discipline wins if its score exceeds a confidence floor;
     otherwise the note is left unclassified (None).

The classifier is intentionally conservative — better to leave a
note unclassified than to mislabel and have Letter P refuse to engage
with a genuinely-philosophy note.
"""
from __future__ import annotations

import re
from collections import defaultdict

from ..models import NoteMetric, NoteRecord, SemanticCluster

DISCIPLINES = ("M", "S", "C", "P", "H")

# Discipline lexicons. Lowercase, single-token where possible.
# Multi-word phrases match if both tokens appear in the note's tokens.
_LEXICONS: dict[str, set[str]] = {
    "M": {
        "theorem", "proof", "lemma", "corollary", "axiom", "matrix",
        "vector", "eigenvalue", "eigenvector", "derivative", "integral",
        "limit", "topology", "manifold", "polynomial", "calculus",
        "linear", "algebra", "geometry", "discrete", "combinatorics",
        "probability", "set", "group", "ring", "field", "function",
        "equation", "differential", "fourier", "laplace", "convex",
        "logarithm", "trigonometry", "isomorphism", "homomorphism",
    },
    "S": {
        "atom", "molecule", "cell", "dna", "rna", "protein", "enzyme",
        "photon", "electron", "neutron", "proton", "quantum", "energy",
        "force", "mass", "velocity", "acceleration", "orbit", "newton",
        "ecosystem", "evolution", "species", "organism", "mitochondria",
        "photosynthesis", "respiration", "thermodynamics", "entropy",
        "gravity", "relativity", "biology", "chemistry", "physics",
        "reaction", "compound", "isotope", "neuron", "synapse",
    },
    "C": {
        "algorithm", "complexity", "data", "structure", "array", "tree",
        "graph", "hash", "stack", "queue", "recursion", "iteration",
        "binary", "compiler", "interpreter", "memory", "cache", "heap",
        "thread", "process", "kernel", "syscall", "python", "javascript",
        "rust", "typescript", "react", "api", "rest", "http", "tcp",
        "database", "sql", "schema", "index", "transaction", "cpu",
        "gpu", "neural", "network", "model", "tensor", "training",
        "regression", "classification",
    },
    "P": {
        "epistemology", "metaphysics", "ontology", "ethics", "morality",
        "consciousness", "knowledge", "justified", "belief", "truth",
        "kant", "hume", "plato", "aristotle", "nietzsche", "wittgenstein",
        "descartes", "hegel", "rawls", "mill", "phenomenology",
        "existentialism", "stoicism", "utilitarianism", "deontology",
        "categorical", "imperative", "free", "will", "determinism",
        "consciousness", "qualia", "soul", "mind", "argument", "premise",
        "conclusion", "fallacy", "syllogism", "dialectic",
    },
    "H": {
        "century", "war", "revolution", "empire", "kingdom", "dynasty",
        "republic", "treaty", "battle", "siege", "monarch", "emperor",
        "renaissance", "enlightenment", "reformation", "industrial",
        "colonial", "decolonization", "constitution", "parliament",
        "senate", "rome", "greece", "byzantium", "ottoman", "mongol",
        "feudal", "medieval", "ancient", "modern", "primary", "source",
        "historiography", "archaeology", "artifact", "civilization",
    },
}

# Tokens that hurt confidence when present (could be in many disciplines).
_NEUTRAL = {
    "note", "section", "summary", "definition", "example", "introduction",
    "chapter", "page", "lecture", "todo",
}


def _normalize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-zA-Z][a-zA-Z\-]+", text.lower()) if t not in _NEUTRAL and len(t) >= 3}


def _score_text(tokens: set[str]) -> dict[str, int]:
    scores: dict[str, int] = {d: 0 for d in DISCIPLINES}
    for d in DISCIPLINES:
        scores[d] = sum(1 for t in _LEXICONS[d] if t in tokens)
    return scores


def _cluster_signal(
    semantic_clusters: list[SemanticCluster],
) -> dict[str, dict[str, int]]:
    """Per-note discipline boost from its parent cluster's keywords."""
    out: dict[str, dict[str, int]] = defaultdict(lambda: {d: 0 for d in DISCIPLINES})
    for c in semantic_clusters:
        text_blob = " ".join(
            list(c.keywords)
            + list(c.evidence_terms)
            + ([c.label] if c.label else [])
            + ([c.parent_topic] if c.parent_topic else [])
            + list(c.hierarchy_path),
        )
        toks = _normalize(text_blob)
        cluster_scores = _score_text(toks)
        # Cluster-level score weighted lower so a single-word match
        # doesn't dominate, but a strong cluster signal still pulls.
        for nid in c.note_ids:
            for d in DISCIPLINES:
                out[nid][d] += cluster_scores[d]
    return out


def classify_notes(
    notes: list[NoteRecord],
    semantic_clusters: list[SemanticCluster],
    declared_discipline_by_space: dict[str, str | None] | None = None,
    min_score: int = 2,
) -> list[tuple[str, str | None, float]]:
    """Return (note_id, discipline | None, confidence in [0,1]) per note."""
    cluster_boost = _cluster_signal(semantic_clusters)
    declared = declared_discipline_by_space or {}

    out: list[tuple[str, str | None, float]] = []
    for n in notes:
        title_toks = _normalize(n.title or "")
        body_toks = _normalize(n.raw_text or "")
        text_scores = _score_text(title_toks)
        body_scores = _score_text(body_toks)
        # Title hits weighted 3x, body 1x, cluster 2x.
        combined: dict[str, int] = {}
        for d in DISCIPLINES:
            combined[d] = (
                3 * text_scores[d]
                + body_scores[d]
                + 2 * cluster_boost.get(n.id, {d: 0}).get(d, 0)
            )

        best = max(combined.items(), key=lambda kv: kv[1])
        d, score = best
        if score < min_score:
            # Fall back to space-declared discipline if any.
            fallback = declared.get(n.space_id)
            if fallback in DISCIPLINES:
                out.append((n.id, fallback, 0.4))
            else:
                out.append((n.id, None, 0.0))
            continue

        # Confidence: how dominant is the winner vs. runners-up?
        total = sum(combined.values()) or 1
        confidence = min(1.0, score / total + 0.2)
        out.append((n.id, d, float(confidence)))

    return out


def attach_to_metrics(
    metrics: list[NoteMetric],
    classifications: list[tuple[str, str | None, float]],
) -> None:
    """Mutate NoteMetric rows in place to set discipline + confidence.

    NoteMetric uses dataclass(slots=False); we add attributes dynamically
    to avoid expanding the dataclass signature for an optional field.
    The store writer reads via getattr with defaults.
    """
    by_id = {nid: (d, c) for nid, d, c in classifications}
    for m in metrics:
        d, c = by_id.get(m.note_id, (None, 0.0))
        setattr(m, "discipline", d)
        setattr(m, "discipline_confidence", c)
