"""Run-level distribution monitoring.

Collects RunMetrics on each run and compares against the recent baseline
(previous N runs for the same space). Flags sharp shifts so production
changes do not silently degrade outputs.
"""
from __future__ import annotations

import statistics

from .models import (
    ConfusionPair,
    DiagnosticResult,
    NoteRecord,
    NoteRole,
    RunMetrics,
    SimilarityEdge,
    TopicCluster,
)


def _bucket(value: float) -> str:
    if value < 0.2:
        return "0.0-0.2"
    if value < 0.4:
        return "0.2-0.4"
    if value < 0.6:
        return "0.4-0.6"
    if value < 0.8:
        return "0.6-0.8"
    return "0.8-1.0"


def collect(
    notes: list[NoteRecord],
    topics: list[TopicCluster],
    sim_edges: list[SimilarityEdge],
    confusion: list[ConfusionPair],
    diag: DiagnosticResult,
    surfaced_counts: dict[str, int],
    suppressed_counts: dict[str, int],
    stage_timings_ms: dict[str, float],
    budget_degraded_stages: list[str],
) -> RunMetrics:
    m = RunMetrics()
    m.edge_count = len(sim_edges)
    if topics:
        m.avg_cluster_size = statistics.fmean(len(t.note_ids) for t in topics)
    m.orphan_rate = len(diag.isolation) / max(1, len(notes))
    m.confusion_density = len(confusion) / max(1, len(topics) * (len(topics) - 1) / 2) if len(topics) > 1 else 0.0

    hist: dict[str, int] = {}
    for e in sim_edges:
        hist[_bucket(e.confidence)] = hist.get(_bucket(e.confidence), 0) + 1
    m.confidence_hist = hist

    roles: dict[str, int] = {}
    for n in notes:
        r = (n.role.value if n.role else NoteRole.UNCLASSIFIED.value)
        roles[r] = roles.get(r, 0) + 1
    total = sum(roles.values()) or 1
    m.role_mix = {k: v / total for k, v in roles.items()}

    m.surfaced_counts = dict(surfaced_counts)
    m.suppressed_counts = dict(suppressed_counts)
    m.stage_timings_ms = dict(stage_timings_ms)
    m.budget_degraded_stages = list(budget_degraded_stages)
    return m


def compare(current: RunMetrics, baseline: list[RunMetrics], z_thresh: float = 2.0) -> list[str]:
    """Return flags for sharp shifts vs baseline (mean+stdev)."""
    if not baseline:
        return []
    flags: list[str] = []

    def _z(name: str, cur: float, vals: list[float]):
        if len(vals) < 2:
            return
        mean = statistics.fmean(vals)
        sd = statistics.pstdev(vals) or 1e-6
        z = (cur - mean) / sd
        if abs(z) >= z_thresh:
            flags.append(f"drift:{name} z={z:+.1f}")

    _z("edge_count", current.edge_count, [b.edge_count for b in baseline])
    _z("avg_cluster_size", current.avg_cluster_size, [b.avg_cluster_size for b in baseline])
    _z("orphan_rate", current.orphan_rate, [b.orphan_rate for b in baseline])
    _z("confusion_density", current.confusion_density, [b.confusion_density for b in baseline])

    for k in current.surfaced_counts:
        hist = [b.surfaced_counts.get(k, 0) for b in baseline]
        _z(f"surfaced:{k}", current.surfaced_counts[k], hist)

    current.drift_flags = flags
    return flags
