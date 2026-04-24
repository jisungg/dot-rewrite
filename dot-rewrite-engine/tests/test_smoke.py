"""Import-everything smoke test. No DB needed."""
from __future__ import annotations


def test_imports():
    from engine import config, db, models, roles, safeguards, calibration, gates  # noqa: F401
    from engine import space_profile, explain, drift, budget, presets  # noqa: F401
    from engine.ingest import normalize, stopwords, lemmatize, phrases, sections, canonical  # noqa: F401
    from engine.represent import lexical, cooccurrence  # noqa: F401
    from engine.similarity import lexical as sl, phrase, structural, recency, fuse  # noqa: F401
    from engine.graph import knn, community, subcluster, centrality, bridge, isolation  # noqa: F401
    from engine.studystate import nodes, edges  # noqa: F401
    from engine.diagnose import coverage, fragmentation, confusion, prereq_gap, integration, negative, confidence  # noqa: F401
    from engine.incremental import local_recompute  # noqa: F401
    from engine.compress import rollup, signatures  # noqa: F401
    from engine.topics import identity  # noqa: F401
    from engine.rank import rankings  # noqa: F401
    from engine.eval import harness  # noqa: F401
    from engine.store import read, write  # noqa: F401
    from engine.pipeline import runner  # noqa: F401


def test_normalize_basic():
    from engine.ingest.normalize import normalize
    assert normalize("  Hello, WORLD!\n") == "hello world"


def test_section_parse():
    from engine.config import SectionWeights
    from engine.ingest.sections import parse
    text = "# Title\n\nDefinition:\n- bullet one\n- bullet two\n\nex: sample example\n\nbody line"
    out = parse(text, SectionWeights())
    kinds = [s.kind.value for s in out]
    assert "title" in kinds and "bullet" in kinds and "example" in kinds
