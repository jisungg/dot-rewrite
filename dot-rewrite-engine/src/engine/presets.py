"""Frozen production presets + feature flag registry.

One golden production mode. New experiments run behind explicit flags and
never alter the default rankings silently. If a flag is not explicitly
enabled, the engine behaves identically to the frozen golden baseline.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field, replace

from .config import Config, FusionWeights, GraphParams, SectionWeights
from .gates import GatePolicy


GOLDEN_VERSION = "golden_v1"


@dataclass(frozen=True)
class FeatureFlags:
    # flip to experiment; defaults keep production stable
    use_space_profile_adaptation: bool = True
    use_hard_output_gates: bool = True
    use_calibration: bool = True
    use_drift_monitoring: bool = True
    use_stage_budgets: bool = True
    enforce_stage_timeouts: bool = False    # signal-based; keep off in worker envs
    write_explanations: bool = True
    experimental_bm25_blend: bool = False
    experimental_recency_boost: bool = False


def from_env() -> FeatureFlags:
    """Respects ENGINE_FLAG_<NAME>=0|1."""
    def b(name: str, default: bool) -> bool:
        v = os.environ.get(f"ENGINE_FLAG_{name}")
        if v is None:
            return default
        return v.lower() in ("1", "true", "yes", "on")
    default = FeatureFlags()
    return FeatureFlags(
        use_space_profile_adaptation=b("PROFILE", default.use_space_profile_adaptation),
        use_hard_output_gates=b("GATES", default.use_hard_output_gates),
        use_calibration=b("CALIBRATION", default.use_calibration),
        use_drift_monitoring=b("DRIFT", default.use_drift_monitoring),
        use_stage_budgets=b("BUDGETS", default.use_stage_budgets),
        enforce_stage_timeouts=b("TIMEOUTS", default.enforce_stage_timeouts),
        write_explanations=b("EXPLAIN", default.write_explanations),
        experimental_bm25_blend=b("EXP_BM25", default.experimental_bm25_blend),
        experimental_recency_boost=b("EXP_RECENCY", default.experimental_recency_boost),
    )


@dataclass
class GoldenPreset:
    version: str
    fusion: FusionWeights
    graph: GraphParams
    sections: SectionWeights
    gate: GatePolicy
    flags: FeatureFlags = field(default_factory=FeatureFlags)


def golden() -> GoldenPreset:
    return GoldenPreset(
        version=GOLDEN_VERSION,
        fusion=FusionWeights(),
        graph=GraphParams(),
        sections=SectionWeights(),
        gate=GatePolicy(name=GOLDEN_VERSION),
        flags=FeatureFlags(),
    )


def golden_config(db_url: str) -> Config:
    preset = golden()
    return Config(
        db_url=db_url,
        fusion=preset.fusion,
        graph=preset.graph,
        sections=preset.sections,
        weight_version=preset.version,
    )
