"""Pipeline orchestrator with production layer.

Stage order:
  1. fetch notes
  2. ingest (normalize / sections / lemma / phrases / canonicalize)
  3. roles
  4. safeguards.audit -> health flags
  5. space_profile.classify -> adjust fusion/graph/gate policy per profile
  6. represent (TF-IDF + co-occurrence)
  7. similarity (fused k-NN with mutual + multi-view)
  8. graph (Leiden + HAC)
  9. studystate (directional prereq)
 10. topic identity alignment
 11. diagnose (coverage / fragmentation / confusion / prereq / integration /
              foundational / bridges / isolation / negative evidence)
 12. calibration + gating -> surfaced rankings + explanations
 13. drift metrics collection + comparison vs prior runs
 14. write everything back (including explanations, run metrics)

Every stage runs through budget.run_stage so runtime issues degrade gracefully.
Feature flags under presets.FeatureFlags toggle production layers.
"""
from __future__ import annotations

import argparse
import logging
import uuid
from dataclasses import replace
from itertools import combinations

import numpy as np

from .. import __version__, config as cfg_mod
from ..budget import DEFAULT_BUDGETS, run_stage
from ..calibration import calibrate_list, calibrate_map, regime_for
from ..compress import rollup, signatures as sig_mod
from ..db import connect
from ..diagnose import (
    confidence as diag_conf,
    confusion as diag_confusion,
    coverage as diag_coverage,
    fragmentation as diag_fragmentation,
    integration as diag_integration,
    negative as diag_neg,
    prereq_gap as diag_prereq,
)
from ..drift import collect as drift_collect
from ..explain import (
    explain_confusion,
    explain_foundational,
    explain_prereq,
    explain_related,
    explain_weak_topic,
)
from ..gates import (
    GatePolicy,
    gate_confusion,
    gate_foundational,
    gate_prereq,
    gate_related_edge,
    gate_weak_topic,
)
from ..graph import bridge, centrality, community, isolation, knn, subcluster
from ..ingest import (
    canonical,
    lemmatize,
    normalize as norm_mod,
    phrases as phr_mod,
    sections as sec_mod,
    stopwords,
)
from ..models import (
    DiagnosticResult,
    EdgeKind,
    NoteRecord,
    RankingExplanation,
    SimilarityEdge,
    SpaceProfile,
    SpaceProfileKind,
    TopicCluster,
)
from ..presets import FeatureFlags, from_env as flags_from_env
from ..rank import rankings
from ..represent import cooccurrence, lexical as lex_repr
from ..roles import apply as apply_roles
from ..safeguards import audit
from ..similarity import (
    fuse as fuse_mod,
    lexical as sim_lexical,
    phrase as sim_phrase,
    recency as sim_recency,
    structural as sim_structural,
)
from ..space_profile import adjust as profile_adjust, classify as profile_classify
from ..store import read as store_read, write as store_write
from ..studystate import edges as study_edges
from ..topics import identity as topic_identity

log = logging.getLogger("engine.pipeline")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--space-id", required=True)
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    cfg = cfg_mod.load()
    logging.basicConfig(level="DEBUG" if args.verbose else cfg.log_level)

    with connect(cfg) as conn:
        snapshot = cfg_mod.snapshot(cfg)
        run = store_write.start_run(conn, args.space_id, __version__, snapshot)
        try:
            notes = store_read.fetch_space_notes(conn, args.space_id)
            result = run_analysis(notes, cfg)
            store_write.replace_sim_edges(conn, args.space_id, result["sim_edges"])
            store_write.replace_study_edges(conn, args.space_id, result["study_edges"])
            store_write.replace_topics(conn, args.space_id, result["topics"])
            store_write.replace_confusion_pairs(conn, args.space_id, result["diag"].confusion_pairs)
            store_write.replace_diagnostics(conn, result["diag"])
            store_write.replace_explanations(conn, args.space_id, result["explanations"])
            store_write.replace_run_metrics(conn, run.id, result["metrics"])
            store_write.finish_run(conn, run, "ok", len(notes),
                                   notes_text=f"profile={result['profile'].kind.value}")
            log.info("run %s ok: profile=%s topics=%d surfaced=%s drift=%s",
                     run.id, result["profile"].kind.value,
                     len(result["topics"]),
                     result["metrics"].surfaced_counts,
                     result["metrics"].drift_flags)
        except Exception as e:
            store_write.finish_run(conn, run, "failed", 0, notes_text=repr(e))
            raise


def run_analysis(
    notes: list[NoteRecord],
    cfg: cfg_mod.Config,
    priors: list | None = None,
    baseline_metrics: list | None = None,
    flags: FeatureFlags | None = None,
) -> dict:
    """Full production pipeline in memory. Returns artifacts + surfaced rankings."""
    if flags is None:
        flags = flags_from_env()

    stage_timings: dict[str, float] = {}
    degraded: list[str] = []

    def _stage(name, fn, fallback):
        return run_stage(
            name, fn, fallback,
            DEFAULT_BUDGETS if flags.use_stage_budgets else {},
            stage_timings, degraded,
            enforce_timeout=flags.enforce_stage_timeouts,
        )

    if len(notes) < 2:
        return _empty_result(notes)

    # ingest
    _stage("ingest", lambda: _ingest(notes, cfg), None)
    _stage("roles", lambda: apply_roles(notes), None)

    # safeguards + profile
    health = audit(notes)
    if flags.use_space_profile_adaptation:
        profile = profile_classify(notes)
        adj = profile_adjust(profile)
        fusion = adj.fusion
        graph_params = adj.graph
        gate_policy = adj.gate
        density_factor = adj.density_factor
    else:
        profile = SpaceProfile(SpaceProfileKind.BALANCED, 1.0)
        fusion = cfg.fusion
        graph_params = cfg.graph
        gate_policy = GatePolicy()
        density_factor = 1.0

    # represent
    lex_space, cooc = _stage("represent", lambda: _represent(notes), (None, None))
    if lex_space is None:
        return _empty_result(notes, health=health, profile=profile)

    # similarity
    fused_map = _stage("similarity",
                       lambda: _fuse_all_pairs(notes, lex_space, cooc, fusion),
                       {})
    sim_edges = _stage("similarity_knn",
                       lambda: knn.build_knn_edges(
                           fused_map,
                           n_notes=len(notes),
                           k=graph_params.k_neighbors,
                           min_weight=graph_params.min_edge_weight,
                           require_views=graph_params.require_views,
                           single_view_override=graph_params.single_view_override,
                           mutual=graph_params.mutual_knn and len(notes) >= 5,
                       ),
                       [])

    # graph
    g, topics, communities_vertex = _stage(
        "graph", lambda: _graph(notes, sim_edges, graph_params), (None, [], [])
    )
    if g is None:
        return _empty_result(notes, health=health, profile=profile)

    # studystate
    degree_scores = {notes[i].id: float(g.degree(i)) / max(1, g.vcount()) for i in range(len(notes))}
    first = study_edges.build_first_introduced(notes)
    study = _stage("studystate",
                   lambda: study_edges.prerequisite_edges(notes, first, degree_scores),
                   [])

    # topic identity + signatures
    pr = centrality.pagerank(g) if g.ecount() else [0.0] * g.vcount()
    bw = bridge.betweenness(g) if g.ecount() else [0.0] * g.vcount()
    central_by_topic: dict[str, list[str]] = {}
    for t, members in zip(topics, communities_vertex):
        ranked = sorted(members, key=lambda v: -pr[v])
        central_by_topic[t.id] = [notes[v].id for v in ranked[:3]]
    notes_by_id = {n.id: n for n in notes}

    pre_sigs = [sig_mod.build(t, notes_by_id, central_by_topic[t.id]) for t in topics]
    if priors:
        topic_identity.align(topics, pre_sigs, priors)
    else:
        for t in topics:
            if not t.stable_id:
                t.stable_id = str(uuid.uuid4())

    for t, members in zip(topics, communities_vertex):
        t.structural_certainty = diag_conf.topic_structural_certainty(g, members)

    # diagnose
    diag = _stage("diagnose",
                  lambda: _diagnose(notes, g, topics, communities_vertex, sim_edges, study, fused_map),
                  _empty_diag(notes))

    # signatures (final, discriminator-aware)
    signatures = []
    for t in topics:
        disc: list[str] = []
        seen: set[str] = set()
        for p in diag.confusion_pairs:
            if p.topic_a == t.id:
                for x in p.discriminators_a:
                    if x not in seen:
                        seen.add(x); disc.append(x)
            elif p.topic_b == t.id:
                for x in p.discriminators_b:
                    if x not in seen:
                        seen.add(x); disc.append(x)
        sig = sig_mod.build(t, notes_by_id, central_by_topic[t.id], disc or None)
        signatures.append(sig)
        rollup.finalize_topic(t, notes_by_id)
        if not t.label:
            t.label = " · ".join(sig.core_terms[:3]) if sig.core_terms else "untitled"

    # ---------- calibration + gates + explanations ----------
    explanations: list[RankingExplanation] = []
    surfaced_counts: dict[str, int] = {
        "related": 0, "confusion": 0, "weakness": 0, "prereq_gap": 0, "foundational": 0,
    }
    suppressed_counts: dict[str, int] = dict(surfaced_counts)

    # related
    surfaced_related_edges: list[SimilarityEdge] = []
    if sim_edges:
        regime = regime_for(len(notes))
        cals = calibrate_list([e.weight for e in sim_edges], regime, density_factor=density_factor) \
            if flags.use_calibration else [None] * len(sim_edges)
        for e, cal in zip(sim_edges, cals):
            if cal is None:
                from ..models import CalibratedScore
                cal = CalibratedScore(raw=e.weight, calibrated=e.weight, percentile=0.5, regime=regime)
            if flags.use_hard_output_gates:
                outcome = gate_related_edge(e, cal,
                                            notes_by_id.get(e.src), notes_by_id.get(e.dst),
                                            gate_policy)
            else:
                from ..gates import GateOutcome
                outcome = GateOutcome(surfaced=True, reasons=["gates_disabled"])
            if flags.write_explanations:
                explanations.append(explain_related(e, cal, outcome, gate_policy.name))
            if outcome.surfaced:
                surfaced_related_edges.append(e)
                surfaced_counts["related"] += 1
            else:
                suppressed_counts["related"] += 1

    # confusion
    surfaced_confusion: list = []
    if diag.confusion_pairs:
        regime = regime_for(len(topics))
        cals = calibrate_list([p.score for p in diag.confusion_pairs], regime, density_factor=density_factor) \
            if flags.use_calibration else [None] * len(diag.confusion_pairs)
        for p, cal in zip(diag.confusion_pairs, cals):
            if cal is None:
                from ..models import CalibratedScore
                cal = CalibratedScore(raw=p.score, calibrated=p.score, percentile=0.5, regime=regime)
            if flags.use_hard_output_gates:
                outcome = gate_confusion(p, cal, gate_policy)
            else:
                from ..gates import GateOutcome
                outcome = GateOutcome(surfaced=True, reasons=["gates_disabled"])
            if flags.write_explanations:
                explanations.append(explain_confusion(p, cal, outcome, gate_policy.name))
            if outcome.surfaced:
                surfaced_confusion.append(p)
                surfaced_counts["confusion"] += 1
            else:
                suppressed_counts["confusion"] += 1

    # weakness
    weakness_raw: dict[str, float] = {}
    for t in topics:
        cov = diag.coverage.get(t.id, 0.0)
        frag = diag.fragmentation.get(t.id, 0.0)
        weakness_raw[t.id] = (1 - cov) * (0.6 + 0.4 * frag)
    weakness_cal = calibrate_map(weakness_raw, regime_for(len(topics)), density_factor=density_factor) \
        if flags.use_calibration else {}
    surfaced_weak: list[str] = []
    for t in topics:
        cal = weakness_cal.get(t.id)
        if cal is None:
            from ..models import CalibratedScore
            cal = CalibratedScore(raw=weakness_raw.get(t.id, 0), calibrated=weakness_raw.get(t.id, 0),
                                  percentile=0.5, regime=regime_for(len(topics)))
        if flags.use_hard_output_gates:
            outcome = gate_weak_topic(t, diag, cal, gate_policy)
        else:
            from ..gates import GateOutcome
            outcome = GateOutcome(surfaced=True, reasons=["gates_disabled"])
        if flags.write_explanations:
            explanations.append(explain_weak_topic(
                t.id, diag.coverage.get(t.id, 0), diag.fragmentation.get(t.id, 0),
                cal, outcome, gate_policy.name,
            ))
        if outcome.surfaced:
            surfaced_weak.append(t.id)
            surfaced_counts["weakness"] += 1
        else:
            suppressed_counts["weakness"] += 1

    # prereq gap
    directional_support = _directional_support_per_note(study)
    pg_cal = calibrate_map(diag.prereq_gaps, regime_for(len(notes)), density_factor=density_factor) \
        if flags.use_calibration else {}
    surfaced_pg: list[str] = []
    for nid, raw in diag.prereq_gaps.items():
        cal = pg_cal.get(nid)
        if cal is None:
            from ..models import CalibratedScore
            cal = CalibratedScore(raw=raw, calibrated=raw, percentile=0.5, regime=regime_for(len(notes)))
        if flags.use_hard_output_gates:
            outcome = gate_prereq(nid, raw, cal, directional_support.get(nid, 0.0), gate_policy)
        else:
            from ..gates import GateOutcome
            outcome = GateOutcome(surfaced=True, reasons=["gates_disabled"])
        if flags.write_explanations:
            explanations.append(explain_prereq(
                nid, directional_support.get(nid, 0.0), cal, outcome, gate_policy.name,
            ))
        if outcome.surfaced:
            surfaced_pg.append(nid)
            surfaced_counts["prereq_gap"] += 1
        else:
            suppressed_counts["prereq_gap"] += 1

    # foundational
    foundational_raw = {notes[i].id: 0.7 * pr[i] + 0.3 * bw[i] for i in range(len(notes))}
    fd_cal = calibrate_map(foundational_raw, regime_for(len(notes)), density_factor=density_factor) \
        if flags.use_calibration else {}
    surfaced_foundational: list[str] = []
    for nid, raw in foundational_raw.items():
        cal = fd_cal.get(nid)
        if cal is None:
            from ..models import CalibratedScore
            cal = CalibratedScore(raw=raw, calibrated=raw, percentile=0.5, regime=regime_for(len(notes)))
        if flags.use_hard_output_gates:
            outcome = gate_foundational(nid, cal, gate_policy)
        else:
            from ..gates import GateOutcome
            outcome = GateOutcome(surfaced=True, reasons=["gates_disabled"])
        i = next((idx for idx, n in enumerate(notes) if n.id == nid), 0)
        if flags.write_explanations:
            explanations.append(explain_foundational(nid, pr[i], bw[i], cal, outcome, gate_policy.name))
        if outcome.surfaced:
            surfaced_foundational.append(nid)
            surfaced_counts["foundational"] += 1
        else:
            suppressed_counts["foundational"] += 1

    # drift metrics
    metrics = drift_collect(
        notes, topics, sim_edges, diag.confusion_pairs, diag,
        surfaced_counts, suppressed_counts, stage_timings, degraded,
    )
    if flags.use_drift_monitoring and baseline_metrics:
        from ..drift import compare as drift_compare
        drift_compare(metrics, baseline_metrics)

    ranked_legacy = {
        "weakest_topics": rankings.weakest_topics(diag, topics),
        "strongest_confusion": rankings.strongest_confusion(diag.confusion_pairs),
        "foundational_notes": rankings.foundational_notes(notes, pr, bw),
        "prerequisite_gaps": rankings.prerequisite_gaps(diag),
    }

    return {
        "notes": notes, "health": health, "profile": profile, "adjustment_density": density_factor,
        "gate_policy": gate_policy,
        "sim_edges": sim_edges, "study_edges": study, "topics": topics,
        "diag": diag, "signatures": signatures,
        "rankings": ranked_legacy,
        "surfaced": {
            "related_edges": surfaced_related_edges,
            "confusion": surfaced_confusion,
            "weak_topics": surfaced_weak,
            "prereq_gaps": surfaced_pg,
            "foundational": surfaced_foundational,
        },
        "surfaced_counts": surfaced_counts,
        "suppressed_counts": suppressed_counts,
        "explanations": explanations,
        "metrics": metrics,
        "stage_timings_ms": stage_timings,
        "degraded_stages": degraded,
        "fused_map": fused_map,
        "graph": g,
    }


# ---------- helpers ----------

def _empty_diag(notes):
    return DiagnosticResult(
        space_id=notes[0].space_id if notes else "",
        coverage={}, fragmentation={}, prereq_gaps={},
        confusion_pairs=[], integration={},
        isolation=[], foundational=[], bridges=[],
    )


def _empty_result(notes, health=None, profile=None):
    from ..models import RunMetrics
    return {
        "notes": notes, "health": health,
        "profile": profile or SpaceProfile(SpaceProfileKind.BALANCED, 0.0),
        "adjustment_density": 1.0,
        "gate_policy": GatePolicy(),
        "sim_edges": [], "study_edges": [], "topics": [],
        "diag": _empty_diag(notes), "signatures": [],
        "rankings": {}, "surfaced": {"related_edges": [], "confusion": [],
                                     "weak_topics": [], "prereq_gaps": [], "foundational": []},
        "surfaced_counts": {}, "suppressed_counts": {}, "explanations": [],
        "metrics": RunMetrics(), "stage_timings_ms": {}, "degraded_stages": [],
        "fused_map": {}, "graph": None,
    }


def _ingest(notes: list[NoteRecord], cfg) -> None:
    stop = stopwords.load()
    lem = lemmatize.build_lemmatizer(cfg.use_spacy)

    all_streams: list[list[str]] = []
    per_note_streams: list[list[list[str]]] = []
    for n in notes:
        n.sections = sec_mod.parse(n.raw_text, cfg.sections)
        streams_for_note: list[list[str]] = []
        for s in n.sections:
            toks = norm_mod.normalize(s.text).split()
            toks = [t for t in toks if t and t not in stop and len(t) > 1]
            s.tokens = lem(toks)
            streams_for_note.append(s.tokens)
            all_streams.append(s.tokens)
        per_note_streams.append(streams_for_note)

    phrased_flat = phr_mod.mine_phrases(all_streams) if all_streams else []
    idx = 0
    for n, streams in zip(notes, per_note_streams):
        tokens: list[str] = []
        phrases: list[str] = []
        for s_idx in range(len(streams)):
            p = phrased_flat[idx] if idx < len(phrased_flat) else streams[s_idx]
            idx += 1
            n.sections[s_idx].tokens = p
            tokens.extend(p)
            phrases.extend(t for t in p if "_" in t)
        n.tokens = tokens
        n.phrases = phrases

    mapping = canonical.build_mapping(notes)
    canonical.apply(notes, mapping)


def _represent(notes: list[NoteRecord]):
    streams = [n.tokens for n in notes]
    lex_space = lex_repr.build_tfidf([n.id for n in notes], streams)
    cooc = cooccurrence.build(streams)
    return lex_space, cooc


def _fuse_all_pairs(notes, lex_space, cooc, fusion_weights) -> dict[tuple[int, int], SimilarityEdge]:
    cos = sim_lexical.pairwise(lex_space)
    top_terms_per_note = [set(n.tokens[:80]) for n in notes]
    out: dict[tuple[int, int], SimilarityEdge] = {}
    for i, j in combinations(range(len(notes)), 2):
        lex = float(cos[i, j])
        if lex < 0.02:
            continue
        ph = sim_phrase.score(set(notes[i].phrases), set(notes[j].phrases))
        st = sim_structural.score(notes[i], notes[j])
        nb = cooccurrence.neighborhood_overlap(cooc, top_terms_per_note[i], top_terms_per_note[j])
        rc = sim_recency.score(notes[i].created_at, notes[j].created_at)
        edge = fuse_mod.fuse(
            notes[i].id, notes[j].id,
            lexical=lex, phrase=ph, structural=st, neighborhood=nb, recency=rc,
            weights=fusion_weights,
        )
        out[(i, j)] = edge
    return out


def _graph(notes, edges, graph_params):
    note_ids = [n.id for n in notes]
    g = community.build_igraph(note_ids, edges)
    try:
        communities = community.leiden(g, graph_params.leiden_resolution)
    except Exception:
        communities = [[i] for i in range(len(notes))]

    id_for_idx = {i: notes[i].id for i in range(len(notes))}
    topics: list[TopicCluster] = []

    for members in communities:
        top = TopicCluster(
            id=str(uuid.uuid4()),
            space_id=notes[0].space_id,
            note_ids=[id_for_idx[i] for i in members],
        )
        if len(members) >= graph_params.subcluster_min_size:
            sub_sim = _subgraph_similarity(g, members)
            groups = subcluster.hac(sub_sim, t=0.55, min_size=graph_params.subcluster_min_size)
            for grp in groups:
                sub_ids = [id_for_idx[members[k]] for k in grp]
                top.subclusters.append(TopicCluster(
                    id=str(uuid.uuid4()),
                    space_id=notes[0].space_id,
                    note_ids=sub_ids,
                    parent_id=top.id,
                ))
        topics.append(top)

    return g, topics, communities


def _subgraph_similarity(g, members):
    n = len(members)
    mat = np.zeros((n, n), dtype=np.float32)
    idx_of = {v: i for i, v in enumerate(members)}
    for eid in range(g.ecount()):
        s, t = g.es[eid].source, g.es[eid].target
        if s in idx_of and t in idx_of:
            w = float(g.es[eid]["weight"])
            mat[idx_of[s], idx_of[t]] = w
            mat[idx_of[t], idx_of[s]] = w
    np.fill_diagonal(mat, 1.0)
    return mat


def _diagnose(notes, g, topics, communities_vertex, sim_edges, study, fused_map) -> DiagnosticResult:
    notes_by_id = {n.id: n for n in notes}
    idx_of = {n.id: i for i, n in enumerate(notes)}

    pr = centrality.pagerank(g) if g.ecount() else [0.0] * g.vcount()
    bw = bridge.betweenness(g) if g.ecount() else [0.0] * g.vcount()

    foundational = (
        [notes[i].id for i in sorted(range(len(notes)), key=lambda i: -pr[i])[: max(1, len(notes) // 10)]]
        if notes else []
    )
    bridge_v = bridge.cross_community_nodes(g, communities_vertex, bw) if g.ecount() else []
    bridges = [notes[i].id for i in bridge_v]

    orphan_v = isolation.orphans(g) if g.ecount() else list(range(len(notes)))
    orphans = [notes[i].id for i in orphan_v]

    coverage: dict[str, float] = {}
    fragmentation: dict[str, float] = {}
    for t, members in zip(topics, communities_vertex):
        sub = g.subgraph(members)
        max_e = len(members) * (len(members) - 1) / 2 if len(members) > 1 else 1
        density = sub.ecount() / max_e if max_e else 0.0
        coverage[t.id] = diag_coverage.score(t, notes_by_id, density)
        fragmentation[t.id] = diag_fragmentation.score(g, members)

    coverage_by_note = {nid: coverage.get(t.id, 0.0) for t in topics for nid in t.note_ids}

    prereq_scores = diag_prereq.score(
        notes,
        [e for e in study if e.kind == EdgeKind.PREREQUISITE],
        coverage_by_note,
    )
    integ_by_idx = diag_integration.score(g, list(range(len(notes))))
    integration = {notes[i].id: v for i, v in integ_by_idx.items()}

    conf_topics = [(t, [idx_of[nid] for nid in t.note_ids]) for t in topics]
    confusion_pairs = diag_confusion.detect(conf_topics, notes_by_id, g)

    mismatch = diag_neg.lexical_structural_mismatch(notes, fused_map)
    mismatch += diag_neg.phrase_example_divergence(notes, fused_map)
    study.extend(mismatch)

    return DiagnosticResult(
        space_id=notes[0].space_id,
        coverage=coverage, fragmentation=fragmentation,
        prereq_gaps=prereq_scores, confusion_pairs=confusion_pairs,
        integration=integration,
        isolation=orphans, foundational=foundational, bridges=bridges,
    )


def _directional_support_per_note(study_edges_list: list[SimilarityEdge]) -> dict[str, float]:
    """Per-note sum of incoming prereq confidence — used by gates."""
    out: dict[str, float] = {}
    for e in study_edges_list:
        if e.kind != EdgeKind.PREREQUISITE:
            continue
        out[e.dst] = out.get(e.dst, 0.0) + e.confidence
    return out
