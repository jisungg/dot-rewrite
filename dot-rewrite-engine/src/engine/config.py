"""Runtime config: env vars, fusion weights, graph params, versioned presets."""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from dotenv import load_dotenv

load_dotenv()

ENGINE_WEIGHT_VERSION = "w2"


@dataclass(frozen=True)
class FusionWeights:
    # Lexical + phrase carry the real signal for study notes. Recency is
    # almost pure noise across a semester of notes — cap it hard. Structural
    # (shared headings / definitions) and neighborhood (co-occurring terms)
    # provide precision without relying on word overlap alone.
    lexical: float = 0.48
    phrase: float = 0.24
    structural: float = 0.15
    neighborhood: float = 0.11
    recency: float = 0.02


@dataclass(frozen=True)
class GraphParams:
    # Tighter k-NN + stronger multi-view requirement => fewer, higher-quality
    # edges. `min_edge_weight` and `single_view_override` act as precision
    # floors that drop marginal pairs before Leiden sees them.
    k_neighbors: int = 12
    min_edge_weight: float = 0.18
    leiden_resolution: float = 1.05
    subcluster_min_size: int = 3
    mutual_knn: bool = True
    require_views: int = 2
    single_view_override: float = 0.50


@dataclass(frozen=True)
class SemanticParams:
    """Controls the primary embedding-based clustering layer."""
    k: int = 10
    min_similarity: float = 0.35
    leiden_resolution: float = 1.0
    mutual_only: bool = False
    keyword_count: int = 6


@dataclass(frozen=True)
class LLMLabelerParams:
    """Lightweight per-cluster topic labeler.

    Does NOT cluster, split, merge, or summarize notes — those are handled
    locally. Given a cluster summary (keywords + titles + short excerpts),
    returns one concrete topic label. One batch call per space, cheap model.
    """
    model: str = "claude-haiku-4-5"
    max_clusters_per_call: int = 40
    max_titles_per_cluster: int = 5
    max_excerpts_per_cluster: int = 3
    max_excerpt_chars: int = 160
    max_keywords_per_cluster: int = 6
    fail_soft: bool = True


@dataclass(frozen=True)
class SectionWeights:
    # Titles and definitions discriminate more than free-flowing body text.
    # Bulleted shopping lists tend to be noisy — demote slightly.
    title: float = 3.0
    definition: float = 2.5
    bullet: float = 0.9
    example: float = 0.8
    body: float = 1.0


@dataclass(frozen=True)
class Config:
    db_url: str
    log_level: str = "INFO"
    fusion: FusionWeights = FusionWeights()
    graph: GraphParams = GraphParams()
    sections: SectionWeights = SectionWeights()
    semantic: SemanticParams = SemanticParams()
    llm_labeler: LLMLabelerParams = LLMLabelerParams()
    use_spacy: bool = True
    weight_version: str = ENGINE_WEIGHT_VERSION


def config_hash(cfg: Config) -> str:
    payload = {
        "weight_version": cfg.weight_version,
        "fusion": asdict(cfg.fusion),
        "graph": asdict(cfg.graph),
        "sections": asdict(cfg.sections),
        "semantic": asdict(cfg.semantic),
        "llm_labeler": asdict(cfg.llm_labeler),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:12]


def snapshot(cfg: Config) -> dict:
    return {
        "weight_version": cfg.weight_version,
        "config_hash": config_hash(cfg),
        "fusion": asdict(cfg.fusion),
        "graph": asdict(cfg.graph),
        "sections": asdict(cfg.sections),
        "semantic": asdict(cfg.semantic),
        "llm_labeler": asdict(cfg.llm_labeler),
        "use_spacy": cfg.use_spacy,
    }


def load() -> Config:
    db_url = os.environ.get("SUPABASE_DB_URL", "")
    if not db_url:
        raise RuntimeError("SUPABASE_DB_URL not set (copy .env.example -> .env)")
    return Config(
        db_url=db_url,
        log_level=os.environ.get("ENGINE_LOG_LEVEL", "INFO"),
        use_spacy=os.environ.get("ENGINE_USE_SPACY", "1") == "1",
    )


def load_for_test(**overrides) -> Config:
    base = Config(db_url="postgres://test/test")
    for k, v in overrides.items():
        object.__setattr__(base, k, v)
    return base
