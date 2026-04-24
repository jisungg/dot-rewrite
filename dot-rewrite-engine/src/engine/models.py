"""Shared internal data objects. Strict types, no loose dicts."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class SectionKind(str, Enum):
    TITLE = "title"
    DEFINITION = "definition"
    BULLET = "bullet"
    EXAMPLE = "example"
    BODY = "body"


class EdgeKind(str, Enum):
    SIMILARITY = "similarity"
    PREREQUISITE = "prerequisite"
    REPETITION = "repetition"
    CONFUSION = "confusion"
    SUPPORT = "support"
    MISMATCH = "mismatch"            # negative evidence


class NoteRole(str, Enum):
    DEFINITION = "definition"
    EXAMPLE = "example"
    DERIVATION = "derivation"
    SUMMARY = "summary"
    QUESTION = "question"
    COMPARISON = "comparison"
    REVIEW = "review"
    LECTURE_DUMP = "lecture_dump"
    FRAGMENT = "fragment"
    UNCLASSIFIED = "unclassified"


@dataclass
class WeightedSection:
    kind: SectionKind
    text: str
    tokens: list[str] = field(default_factory=list)
    weight: float = 1.0


@dataclass
class NoteRecord:
    id: str
    space_id: str
    title: str
    raw_text: str
    created_at: datetime
    updated_at: datetime
    sections: list[WeightedSection] = field(default_factory=list)
    tokens: list[str] = field(default_factory=list)
    phrases: list[str] = field(default_factory=list)
    concepts: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    pinned: bool = False
    processed: bool = False
    user_id: str = ""
    role: "NoteRole | None" = None
    role_confidence: float = 0.0
    length_class: str = "medium"  # short | medium | long | fragment


@dataclass
class SimilarityEdge:
    src: str
    dst: str
    weight: float
    kind: EdgeKind = EdgeKind.SIMILARITY
    components: dict[str, float] = field(default_factory=dict)
    confidence: float = 0.0            # multi-view edge confidence [0,1]
    views_supporting: int = 0          # how many signals back this edge
    direction: str | None = None       # "src->dst" for prereq/support, None otherwise


@dataclass
class TopicCluster:
    id: str
    space_id: str
    note_ids: list[str]
    label: str | None = None
    keywords: list[str] = field(default_factory=list)
    subclusters: list["TopicCluster"] = field(default_factory=list)
    centroid_terms: list[str] = field(default_factory=list)
    parent_id: str | None = None
    stable_id: str | None = None       # persistent identity across runs
    role_mix: dict[str, float] = field(default_factory=dict)
    structural_certainty: float = 0.0  # graph evidence strength [0,1]


@dataclass
class TopicSignature:
    topic_id: str
    stable_id: str
    core_terms: list[str]              # high-confidence discriminative
    supporting_terms: list[str]
    central_note_ids: list[str]
    role_mix: dict[str, float]
    term_signature_hash: str


@dataclass
class ConfusionPair:
    topic_a: str
    topic_b: str
    score: float                       # closeness / separability
    closeness: float = 0.0
    separability: float = 0.0
    shared_core_terms: list[str] = field(default_factory=list)
    discriminators_a: list[str] = field(default_factory=list)
    discriminators_b: list[str] = field(default_factory=list)
    shared_terms: list[str] = field(default_factory=list)  # back-compat
    missing_distinguishing_terms: list[str] = field(default_factory=list)
    structural_certainty: float = 0.0
    interpretive_confidence: float = 0.0


@dataclass
class DiagnosticResult:
    space_id: str
    coverage: dict[str, float]            # topic_id -> score
    fragmentation: dict[str, float]
    prereq_gaps: dict[str, float]         # note_id -> score
    confusion_pairs: list[ConfusionPair]
    integration: dict[str, float]         # note_id -> score
    isolation: list[str]                  # orphan note_ids
    foundational: list[str]               # high-centrality note_ids
    bridges: list[str]                    # bridge note_ids


class SpaceProfileKind(str, Enum):
    GLOSSARY = "glossary"
    LECTURE_DUMP = "lecture_dump"
    MIXED_SUBJECT = "mixed_subject"
    FORMULA_HEAVY = "formula_heavy"
    FRAGMENT_HEAVY = "fragment_heavy"
    REFLECTIVE = "reflective"
    BALANCED = "balanced"


@dataclass
class SpaceProfile:
    kind: SpaceProfileKind
    confidence: float
    evidence: dict[str, float] = field(default_factory=dict)


@dataclass
class CalibratedScore:
    raw: float
    calibrated: float                    # normalized to [0,1] within space+regime
    percentile: float                    # rank percentile in-space
    regime: str                          # "small" | "medium" | "large"
    floor_passed: bool = True


@dataclass
class RankingExplanation:
    ranking_kind: str                    # "related" | "confusion" | "weakness" | ...
    subject_id: str                      # note_id or "topic_a|topic_b" etc.
    surfaced: bool
    calibrated: float
    raw: float
    top_features: list[tuple[str, float]] = field(default_factory=list)
    suppression_reasons: list[str] = field(default_factory=list)
    gate_policy: str = ""


@dataclass
class RunMetrics:
    edge_count: int = 0
    avg_cluster_size: float = 0.0
    orphan_rate: float = 0.0
    confusion_density: float = 0.0
    confidence_hist: dict[str, int] = field(default_factory=dict)   # bucket -> count
    role_mix: dict[str, float] = field(default_factory=dict)
    surfaced_counts: dict[str, int] = field(default_factory=dict)   # ranking -> # surfaced
    suppressed_counts: dict[str, int] = field(default_factory=dict)
    drift_flags: list[str] = field(default_factory=list)
    stage_timings_ms: dict[str, float] = field(default_factory=dict)
    budget_degraded_stages: list[str] = field(default_factory=list)


@dataclass
class AnalysisRun:
    id: str
    space_id: str
    started_at: datetime
    finished_at: datetime | None
    status: str
    note_count: int
    engine_version: str
    weights_json: str
    notes: str = ""
