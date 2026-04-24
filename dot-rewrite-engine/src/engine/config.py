"""Runtime config: env vars, fusion weights, graph params, versioned presets."""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from dotenv import load_dotenv

load_dotenv()

ENGINE_WEIGHT_VERSION = "w1"


@dataclass(frozen=True)
class FusionWeights:
    lexical: float = 0.45
    phrase: float = 0.20
    structural: float = 0.15
    neighborhood: float = 0.15
    recency: float = 0.05


@dataclass(frozen=True)
class GraphParams:
    k_neighbors: int = 15
    min_edge_weight: float = 0.10
    leiden_resolution: float = 1.0
    subcluster_min_size: int = 3
    mutual_knn: bool = True
    require_views: int = 2
    single_view_override: float = 0.35


@dataclass(frozen=True)
class SectionWeights:
    title: float = 2.5
    definition: float = 2.0
    bullet: float = 1.0
    example: float = 0.7
    body: float = 1.0


@dataclass(frozen=True)
class Config:
    db_url: str
    log_level: str = "INFO"
    fusion: FusionWeights = FusionWeights()
    graph: GraphParams = GraphParams()
    sections: SectionWeights = SectionWeights()
    use_spacy: bool = True
    weight_version: str = ENGINE_WEIGHT_VERSION


def config_hash(cfg: Config) -> str:
    payload = {
        "weight_version": cfg.weight_version,
        "fusion": asdict(cfg.fusion),
        "graph": asdict(cfg.graph),
        "sections": asdict(cfg.sections),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:12]


def snapshot(cfg: Config) -> dict:
    return {
        "weight_version": cfg.weight_version,
        "config_hash": config_hash(cfg),
        "fusion": asdict(cfg.fusion),
        "graph": asdict(cfg.graph),
        "sections": asdict(cfg.sections),
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
