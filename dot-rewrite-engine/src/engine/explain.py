"""Feature store snapshot — top contributing features + suppression reasons.

One RankingExplanation per emission (surfaced or suppressed). Written back
to the database so production debugging has evidence: 'this pair was hidden
because structural_certainty was 0.12 < 0.20'.
"""
from __future__ import annotations

from .gates import GateOutcome
from .models import (
    CalibratedScore,
    ConfusionPair,
    RankingExplanation,
    SimilarityEdge,
)


def explain_related(
    edge: SimilarityEdge,
    calibrated: CalibratedScore,
    outcome: GateOutcome,
    policy_name: str,
) -> RankingExplanation:
    top = sorted(edge.components.items(), key=lambda kv: -kv[1])[:4]
    subject = f"{edge.src}|{edge.dst}"
    return RankingExplanation(
        ranking_kind="related",
        subject_id=subject,
        surfaced=outcome.surfaced,
        calibrated=calibrated.calibrated,
        raw=edge.weight,
        top_features=[(k, float(v)) for k, v in top],
        suppression_reasons=[] if outcome.surfaced else outcome.reasons,
        gate_policy=policy_name,
    )


def explain_confusion(
    pair: ConfusionPair,
    calibrated: CalibratedScore,
    outcome: GateOutcome,
    policy_name: str,
) -> RankingExplanation:
    feats = [
        ("closeness", pair.closeness),
        ("separability", pair.separability),
        ("structural_certainty", pair.structural_certainty),
        ("interpretive_confidence", pair.interpretive_confidence),
    ]
    return RankingExplanation(
        ranking_kind="confusion",
        subject_id=f"{pair.topic_a}|{pair.topic_b}",
        surfaced=outcome.surfaced,
        calibrated=calibrated.calibrated,
        raw=pair.score,
        top_features=feats,
        suppression_reasons=[] if outcome.surfaced else outcome.reasons,
        gate_policy=policy_name,
    )


def explain_weak_topic(
    topic_id: str,
    coverage: float,
    fragmentation: float,
    calibrated: CalibratedScore,
    outcome: GateOutcome,
    policy_name: str,
) -> RankingExplanation:
    return RankingExplanation(
        ranking_kind="weakness",
        subject_id=topic_id,
        surfaced=outcome.surfaced,
        calibrated=calibrated.calibrated,
        raw=calibrated.raw,
        top_features=[("coverage", coverage), ("fragmentation", fragmentation)],
        suppression_reasons=[] if outcome.surfaced else outcome.reasons,
        gate_policy=policy_name,
    )


def explain_prereq(
    note_id: str,
    directional_support: float,
    calibrated: CalibratedScore,
    outcome: GateOutcome,
    policy_name: str,
) -> RankingExplanation:
    return RankingExplanation(
        ranking_kind="prereq_gap",
        subject_id=note_id,
        surfaced=outcome.surfaced,
        calibrated=calibrated.calibrated,
        raw=calibrated.raw,
        top_features=[("directional_support", directional_support)],
        suppression_reasons=[] if outcome.surfaced else outcome.reasons,
        gate_policy=policy_name,
    )


def explain_foundational(
    note_id: str,
    pagerank: float,
    betweenness: float,
    calibrated: CalibratedScore,
    outcome: GateOutcome,
    policy_name: str,
) -> RankingExplanation:
    return RankingExplanation(
        ranking_kind="foundational",
        subject_id=note_id,
        surfaced=outcome.surfaced,
        calibrated=calibrated.calibrated,
        raw=calibrated.raw,
        top_features=[("pagerank", pagerank), ("betweenness", betweenness)],
        suppression_reasons=[] if outcome.surfaced else outcome.reasons,
        gate_policy=policy_name,
    )
