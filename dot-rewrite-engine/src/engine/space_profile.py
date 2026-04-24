"""Classify a space and adapt weights / thresholds to its profile.

Seven profiles cover most real study spaces:
  glossary         — many tiny definitions, uniform structure
  lecture_dump     — a few very long notes, heavy prose
  mixed_subject    — multiple unrelated topics share the same space
  formula_heavy    — lots of short equations / derivations
  fragment_heavy   — tiny scraps, questions, TODOs
  reflective       — long prose-y notes with few distinguishing terms
  balanced         — the healthy default

Per-profile adjustments reshape fusion weights, graph params, and gate policy.
A formula-heavy physics space rewards structural + phrase overlap and tightens
confusion thresholds; a reflective space needs looser clustering and more
conservative confusion gating.
"""
from __future__ import annotations

from dataclasses import dataclass, replace

from .config import FusionWeights, GraphParams
from .gates import GatePolicy
from .models import NoteRecord, NoteRole, SpaceProfile, SpaceProfileKind


_FORMULA_CHARS = set("=+-*/^∑∫∂≈≥≤≠αβγδθλμπσφ")


def _fraction(predicate, notes: list[NoteRecord]) -> float:
    if not notes:
        return 0.0
    return sum(1 for n in notes if predicate(n)) / len(notes)


def _formula_density(n: NoteRecord) -> float:
    text = n.raw_text or ""
    if not text:
        return 0.0
    hits = sum(1 for c in text if c in _FORMULA_CHARS)
    return hits / max(1, len(text))


def classify(notes: list[NoteRecord]) -> SpaceProfile:
    if not notes:
        return SpaceProfile(SpaceProfileKind.BALANCED, 0.0)

    n = len(notes)
    avg_len = sum(len(nn.tokens) for nn in notes) / n
    # avg_len can be 0 if classify runs before ingest — caller should ingest first
    frag_frac = _fraction(lambda nn: nn.role == NoteRole.FRAGMENT, notes)
    def_frac = _fraction(lambda nn: nn.role == NoteRole.DEFINITION, notes)
    lecture_frac = _fraction(lambda nn: nn.role == NoteRole.LECTURE_DUMP, notes)
    formula_avg = sum(_formula_density(nn) for nn in notes) / n
    tags_per_note = sum(len(nn.tags) for nn in notes) / n
    unique_tags = len({t for nn in notes for t in nn.tags})
    tag_spread = unique_tags / max(1, n)

    evidence = {
        "avg_len": avg_len,
        "frag_frac": frag_frac,
        "def_frac": def_frac,
        "lecture_frac": lecture_frac,
        "formula_avg": formula_avg,
        "tag_spread": tag_spread,
    }

    # scoring each profile
    scores: dict[SpaceProfileKind, float] = {k: 0.0 for k in SpaceProfileKind}

    if def_frac >= 0.55 and avg_len < 80:
        scores[SpaceProfileKind.GLOSSARY] += 1.0 + def_frac
    if lecture_frac >= 0.3 or (avg_len > 400 and def_frac < 0.4):
        scores[SpaceProfileKind.LECTURE_DUMP] += 1.0 + lecture_frac
    if tag_spread > 0.5 and unique_tags >= 3:
        scores[SpaceProfileKind.MIXED_SUBJECT] += 1.0 + tag_spread
    if formula_avg > 0.02:
        scores[SpaceProfileKind.FORMULA_HEAVY] += 1.0 + min(2.0, formula_avg * 50)
    if frag_frac >= 0.5:
        scores[SpaceProfileKind.FRAGMENT_HEAVY] += 1.0 + frag_frac
    if avg_len > 200 and def_frac < 0.25 and lecture_frac < 0.2 and formula_avg < 0.01:
        scores[SpaceProfileKind.REFLECTIVE] += 1.0

    scores[SpaceProfileKind.BALANCED] = 0.6  # default fallback baseline

    kind, top = max(scores.items(), key=lambda kv: kv[1])
    others = sorted(scores.values(), reverse=True)
    second = others[1] if len(others) > 1 else 0.0
    conf = max(0.0, min(1.0, (top - second) / max(top, 1e-6)))
    return SpaceProfile(kind=kind, confidence=float(conf), evidence=evidence)


# ----- per-profile adjustments -----

@dataclass(frozen=True)
class ProfileAdjustment:
    fusion: FusionWeights
    graph: GraphParams
    gate: GatePolicy
    density_factor: float = 1.0   # passed to calibration


def _default_gate() -> GatePolicy:
    return GatePolicy()


PROFILE_PRESETS: dict[SpaceProfileKind, ProfileAdjustment] = {
    SpaceProfileKind.GLOSSARY: ProfileAdjustment(
        fusion=FusionWeights(lexical=0.50, phrase=0.25, structural=0.10, neighborhood=0.10, recency=0.05),
        graph=GraphParams(k_neighbors=10, min_edge_weight=0.12, subcluster_min_size=2,
                          require_views=2, single_view_override=0.40, mutual_knn=False),
        gate=replace(_default_gate(), confusion_min_calibrated=0.60, weakness_min_calibrated=0.55),
        density_factor=1.1,
    ),
    SpaceProfileKind.LECTURE_DUMP: ProfileAdjustment(
        fusion=FusionWeights(lexical=0.40, phrase=0.25, structural=0.20, neighborhood=0.10, recency=0.05),
        graph=GraphParams(k_neighbors=20, min_edge_weight=0.10, subcluster_min_size=3,
                          require_views=2, single_view_override=0.35, mutual_knn=True),
        gate=replace(_default_gate(), weakness_min_calibrated=0.55, prereq_min_calibrated=0.50),
        density_factor=1.0,
    ),
    SpaceProfileKind.MIXED_SUBJECT: ProfileAdjustment(
        fusion=FusionWeights(lexical=0.40, phrase=0.20, structural=0.20, neighborhood=0.15, recency=0.05),
        graph=GraphParams(k_neighbors=8, min_edge_weight=0.15, subcluster_min_size=2,
                          require_views=2, single_view_override=0.40, mutual_knn=True),
        gate=replace(_default_gate(), confusion_min_calibrated=0.65, related_min_calibrated=0.55,
                     confusion_min_structural_certainty=0.35),
        density_factor=1.15,
    ),
    SpaceProfileKind.FORMULA_HEAVY: ProfileAdjustment(
        fusion=FusionWeights(lexical=0.40, phrase=0.30, structural=0.15, neighborhood=0.10, recency=0.05),
        graph=GraphParams(k_neighbors=12, min_edge_weight=0.12, subcluster_min_size=2,
                          require_views=2, single_view_override=0.40, mutual_knn=True),
        gate=replace(_default_gate(), confusion_min_calibrated=0.62, weakness_min_calibrated=0.55),
        density_factor=1.05,
    ),
    SpaceProfileKind.FRAGMENT_HEAVY: ProfileAdjustment(
        fusion=FusionWeights(lexical=0.50, phrase=0.15, structural=0.15, neighborhood=0.15, recency=0.05),
        graph=GraphParams(k_neighbors=6, min_edge_weight=0.14, subcluster_min_size=2,
                          require_views=1, single_view_override=0.30, mutual_knn=False),
        gate=replace(_default_gate(), related_min_calibrated=0.55, confusion_min_calibrated=0.65,
                     weakness_min_calibrated=0.60, related_role_filter_fragment=False),
        density_factor=1.2,
    ),
    SpaceProfileKind.REFLECTIVE: ProfileAdjustment(
        fusion=FusionWeights(lexical=0.40, phrase=0.20, structural=0.15, neighborhood=0.20, recency=0.05),
        graph=GraphParams(k_neighbors=12, min_edge_weight=0.10, subcluster_min_size=3,
                          require_views=2, single_view_override=0.35, mutual_knn=True),
        gate=replace(_default_gate(), confusion_min_calibrated=0.65,
                     confusion_min_structural_certainty=0.35),
        density_factor=1.1,
    ),
    SpaceProfileKind.BALANCED: ProfileAdjustment(
        fusion=FusionWeights(),
        graph=GraphParams(),
        gate=_default_gate(),
        density_factor=1.0,
    ),
}


def adjust(profile: SpaceProfile) -> ProfileAdjustment:
    return PROFILE_PRESETS[profile.kind]
