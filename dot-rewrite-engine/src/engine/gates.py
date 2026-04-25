"""Hard output gates + suppression policies.

Every ranking emission runs through one of these gates. A gate decides whether
an item is surfaced to the UI or suppressed, and records the reasons either
way so explain.py can persist a complete audit trail.

Gates are tuned conservatively. The default posture is: suppress unless every
required signal clears its bar. In production the cost of a confident wrong
output is much higher than the cost of a missing output.
"""
from __future__ import annotations

from dataclasses import dataclass

from .models import (
    CalibratedScore,
    ConfusionPair,
    DiagnosticResult,
    NoteRecord,
    NoteRole,
    SimilarityEdge,
    TopicCluster,
)


@dataclass(frozen=True)
class GatePolicy:
    name: str = "golden_v1"

    # related notes — tightened for precision (was 0.18/0.45/0.20).
    related_min_raw: float = 0.22
    related_min_calibrated: float = 0.50
    related_min_confidence: float = 0.25
    related_min_views: int = 2
    related_role_filter_fragment: bool = True   # drop edges where either side is FRAGMENT

    # confusion
    confusion_min_calibrated: float = 0.55
    confusion_min_closeness: float = 0.30
    confusion_max_separability: float = 0.70
    confusion_min_structural_certainty: float = 0.20
    confusion_min_interpretive: float = 0.30

    # weak topics
    weakness_min_calibrated: float = 0.50
    weakness_max_coverage: float = 0.55
    weakness_min_fragmentation: float = 0.10
    weakness_require_joint: bool = True          # require both coverage & frag signals

    # prerequisite gaps
    prereq_min_calibrated: float = 0.45
    prereq_min_raw: float = 0.20
    prereq_require_directional: bool = True

    # foundational
    foundational_min_calibrated: float = 0.55


@dataclass
class GateOutcome:
    surfaced: bool
    reasons: list[str]                  # either positive signals or suppression causes


# -------------- related --------------

def gate_related_edge(
    edge: SimilarityEdge,
    calibrated: CalibratedScore,
    src_note: NoteRecord | None,
    dst_note: NoteRecord | None,
    policy: GatePolicy,
) -> GateOutcome:
    reasons: list[str] = []
    ok = True
    if edge.weight < policy.related_min_raw:
        reasons.append(f"raw<{policy.related_min_raw}")
        ok = False
    if calibrated.calibrated < policy.related_min_calibrated:
        reasons.append(f"calibrated<{policy.related_min_calibrated}")
        ok = False
    if edge.confidence < policy.related_min_confidence:
        reasons.append(f"confidence<{policy.related_min_confidence}")
        ok = False
    if edge.views_supporting < policy.related_min_views:
        reasons.append(f"views<{policy.related_min_views}")
        ok = False
    if policy.related_role_filter_fragment:
        for n in (src_note, dst_note):
            if n and n.role == NoteRole.FRAGMENT:
                reasons.append("role:fragment")
                ok = False
                break
    if not calibrated.floor_passed:
        reasons.append("regime_floor")
        ok = False
    if ok:
        reasons.append(f"views={edge.views_supporting}")
        reasons.append(f"conf={edge.confidence:.2f}")
    return GateOutcome(surfaced=ok, reasons=reasons)


# -------------- confusion --------------

def gate_confusion(
    pair: ConfusionPair,
    calibrated: CalibratedScore,
    policy: GatePolicy,
) -> GateOutcome:
    reasons: list[str] = []
    ok = True
    if calibrated.calibrated < policy.confusion_min_calibrated:
        reasons.append(f"calibrated<{policy.confusion_min_calibrated}")
        ok = False
    if pair.closeness < policy.confusion_min_closeness:
        reasons.append(f"closeness<{policy.confusion_min_closeness}")
        ok = False
    if pair.separability > policy.confusion_max_separability:
        reasons.append(f"separability>{policy.confusion_max_separability}")
        ok = False
    if pair.structural_certainty < policy.confusion_min_structural_certainty:
        reasons.append(f"structural_cert<{policy.confusion_min_structural_certainty}")
        ok = False
    if pair.interpretive_confidence < policy.confusion_min_interpretive:
        reasons.append(f"interp_conf<{policy.confusion_min_interpretive}")
        ok = False
    if not calibrated.floor_passed:
        reasons.append("regime_floor")
        ok = False
    if ok:
        reasons.append(f"close={pair.closeness:.2f}")
        reasons.append(f"sep={pair.separability:.2f}")
    return GateOutcome(surfaced=ok, reasons=reasons)


# -------------- weakness --------------

def gate_weak_topic(
    topic: TopicCluster,
    diag: DiagnosticResult,
    calibrated: CalibratedScore,
    policy: GatePolicy,
) -> GateOutcome:
    reasons: list[str] = []
    ok = True
    cov = diag.coverage.get(topic.id, 0.0)
    frag = diag.fragmentation.get(topic.id, 0.0)

    if calibrated.calibrated < policy.weakness_min_calibrated:
        reasons.append(f"calibrated<{policy.weakness_min_calibrated}")
        ok = False
    if cov > policy.weakness_max_coverage:
        reasons.append(f"coverage>{policy.weakness_max_coverage}")
        ok = False
    if policy.weakness_require_joint and frag < policy.weakness_min_fragmentation:
        reasons.append(f"fragmentation<{policy.weakness_min_fragmentation}")
        ok = False
    if not calibrated.floor_passed:
        reasons.append("regime_floor")
        ok = False
    if ok:
        reasons.append(f"cov={cov:.2f}")
        reasons.append(f"frag={frag:.2f}")
    return GateOutcome(surfaced=ok, reasons=reasons)


# -------------- prereq gap --------------

def gate_prereq(
    note_id: str,
    raw: float,
    calibrated: CalibratedScore,
    directional_support: float,
    policy: GatePolicy,
) -> GateOutcome:
    reasons: list[str] = []
    ok = True
    if raw < policy.prereq_min_raw:
        reasons.append(f"raw<{policy.prereq_min_raw}")
        ok = False
    if calibrated.calibrated < policy.prereq_min_calibrated:
        reasons.append(f"calibrated<{policy.prereq_min_calibrated}")
        ok = False
    if policy.prereq_require_directional and directional_support < 0.15:
        reasons.append("weak_directional_evidence")
        ok = False
    if not calibrated.floor_passed:
        reasons.append("regime_floor")
        ok = False
    if ok:
        reasons.append(f"dir_evidence={directional_support:.2f}")
    return GateOutcome(surfaced=ok, reasons=reasons)


# -------------- foundational --------------

def gate_foundational(note_id: str, calibrated: CalibratedScore, policy: GatePolicy) -> GateOutcome:
    reasons: list[str] = []
    ok = True
    if calibrated.calibrated < policy.foundational_min_calibrated:
        reasons.append(f"calibrated<{policy.foundational_min_calibrated}")
        ok = False
    if not calibrated.floor_passed:
        reasons.append("regime_floor")
        ok = False
    if ok:
        reasons.append(f"pct={calibrated.percentile:.2f}")
    return GateOutcome(surfaced=ok, reasons=reasons)
