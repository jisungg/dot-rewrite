"""Extensive pipeline tests. Runs full engine against 5 synthetic spaces and
prints short + long summaries. No DB required.

Run with `-s` to see printed reports:
  uv run pytest tests/test_extensive.py -s -q
"""
from __future__ import annotations

import textwrap

import pytest

from engine.config import Config, FusionWeights, GraphParams, SectionWeights, snapshot
from engine.eval.harness import (
    Gold,
    confusion_recall,
    precision_recall_at_k,
    topic_purity,
)
from engine.pipeline.runner import run_analysis
from engine.rank import rankings as rank_api

from fixtures import (
    biology_clean,
    glossary_heavy,
    mixed_classes,
    repetitive_lecture,
    sparse_space,
)

FIXTURES = [
    ("biology_clean", biology_clean),
    ("sparse_space", sparse_space),
    ("repetitive_lecture", repetitive_lecture),
    ("mixed_classes", mixed_classes),
    ("glossary_heavy", glossary_heavy),
]


def _cfg() -> Config:
    return Config(
        db_url="postgres://test",
        fusion=FusionWeights(),
        graph=GraphParams(k_neighbors=6, min_edge_weight=0.08,
                          subcluster_min_size=2, require_views=1,
                          single_view_override=0.25, mutual_knn=False),
        sections=SectionWeights(),
        use_spacy=False,
    )


def _title(nid: str, notes) -> str:
    for n in notes:
        if n.id == nid:
            return n.title
    return nid[:8]


def _short_summary(name, health, topics, diag, ranked) -> str:
    lines = [f"[{name}] short"]
    lines.append(f"  notes={health.note_count if health else 0} tokens={health.token_count if health else 0}")
    lines.append(f"  flags={health.flags if health else []}")
    lines.append(f"  topics={len(topics)} confusion_pairs={len(diag.confusion_pairs)}"
                 f" foundational={len(diag.foundational)} orphans={len(diag.isolation)}")
    if ranked.get("weakest_topics"):
        top = ranked["weakest_topics"][0]
        lines.append(f"  weakest_topic_score={top.score:.2f} reasons={top.reasons}")
    if ranked.get("strongest_confusion"):
        top = ranked["strongest_confusion"][0]
        lines.append(f"  top_confusion_score={top.score:.2f} reasons={top.reasons}")
    return "\n".join(lines)


def _long_summary(name, notes, health, topics, diag, signatures, ranked, metrics) -> str:
    by_id = {n.id: n for n in notes}
    lines = [f"========== {name} (long) =========="]
    lines.append(f"notes={len(notes)}  tokens={health.token_count if health else 0}  "
                 f"repetitive={health.repetitive_score if health else 0:.2f}")
    lines.append(f"flags: {health.flags if health else []}")
    lines.append("")
    lines.append("-- roles --")
    for n in notes:
        r = n.role.value if n.role else "?"
        lines.append(f"  [{r:>12s} c={n.role_confidence:.2f} len={n.length_class:<8s}] "
                     f"{n.title[:60]}")
    lines.append("")
    lines.append(f"-- topics ({len(topics)}) --")
    for t in topics:
        mix = ", ".join(f"{k}={v:.2f}" for k, v in sorted(t.role_mix.items(), key=lambda kv: -kv[1])[:3])
        lines.append(f"  topic stable={t.stable_id[:8] if t.stable_id else '--':>8}  "
                     f"cert={t.structural_certainty:.2f}  "
                     f"cov={diag.coverage.get(t.id, 0):.2f}  "
                     f"frag={diag.fragmentation.get(t.id, 0):.2f}  "
                     f"n={len(t.note_ids)}  label={t.label!r}")
        for nid in t.note_ids:
            lines.append(f"      - {by_id[nid].title[:70]}")
        lines.append(f"      mix: {mix}")
    lines.append("")
    lines.append("-- topic signatures --")
    for s in signatures:
        lines.append(f"  {s.term_signature_hash}  core={s.core_terms[:6]}  support={s.supporting_terms[:4]}")
    lines.append("")
    lines.append("-- confusion pairs --")
    if not diag.confusion_pairs:
        lines.append("  (none)")
    for p in diag.confusion_pairs:
        a = next((t for t in topics if t.id == p.topic_a), None)
        b = next((t for t in topics if t.id == p.topic_b), None)
        lines.append(f"  score={p.score:.2f}  close={p.closeness:.2f}  sep={p.separability:.2f}  "
                     f"conf={p.interpretive_confidence:.2f}  cert={p.structural_certainty:.2f}")
        lines.append(f"    A: {a.label if a else p.topic_a[:8]!r}  disc={p.discriminators_a[:5]}")
        lines.append(f"    B: {b.label if b else p.topic_b[:8]!r}  disc={p.discriminators_b[:5]}")
        lines.append(f"    shared_core={p.shared_core_terms[:6]}")
    lines.append("")
    lines.append("-- rankings top-5 --")
    for name_r in ("weakest_topics", "strongest_confusion", "foundational_notes", "prerequisite_gaps"):
        rs = ranked.get(name_r) or []
        lines.append(f"  {name_r}:")
        for item in rs[:5]:
            label = item.id[:8]
            if name_r == "foundational_notes":
                label = by_id.get(item.id).title[:40] if by_id.get(item.id) else label
            elif name_r == "weakest_topics":
                t = next((t for t in topics if t.id == item.id), None)
                label = (t.label or item.id[:8]) if t else item.id[:8]
            lines.append(f"    - {label}  score={item.score:.2f}  reasons={item.reasons}")
    lines.append("")
    lines.append(f"-- eval metrics --")
    if metrics:
        for k, v in metrics.items():
            lines.append(f"  {k}: {v:.3f}" if isinstance(v, float) else f"  {k}: {v}")
    lines.append("========== end ==========\n")
    return "\n".join(lines)


def _gold_to_pred(diag, topics, sim_edges, notes):
    # related@k
    pred_by_note: dict[str, list[str]] = {}
    by_note: dict[str, list] = {}
    for e in sim_edges:
        by_note.setdefault(e.src, []).append((e.weight, e.dst))
        by_note.setdefault(e.dst, []).append((e.weight, e.src))
    for nid, lst in by_note.items():
        lst.sort(reverse=True)
        pred_by_note[nid] = [other for _, other in lst[:10]]

    # topic groups
    pred_groups = [t.note_ids for t in topics]

    # confusion
    pred_pairs = []
    # engine stores topic-level pairs; convert to representative note pairs
    topic_by_id = {t.id: t for t in topics}
    for p in diag.confusion_pairs:
        ta = topic_by_id.get(p.topic_a)
        tb = topic_by_id.get(p.topic_b)
        if not ta or not tb or not ta.note_ids or not tb.note_ids:
            continue
        pred_pairs.append((ta.note_ids[0], tb.note_ids[0]))
    return pred_by_note, pred_groups, pred_pairs


@pytest.mark.parametrize("name,factory", FIXTURES)
def test_space(name, factory, capsys):
    _, notes, gold_raw = factory()
    cfg = _cfg()
    result = run_analysis(notes, cfg)

    health = result["health"]
    topics = result["topics"]
    diag = result["diag"]
    signatures = result["signatures"]
    ranked = result["rankings"]

    # basic guarantees
    assert health is not None
    assert len(topics) >= 1

    # evaluate if gold provided
    metrics: dict = {}
    if gold_raw:
        pred_by_note, pred_groups, pred_pairs = _gold_to_pred(diag, topics, result["sim_edges"], notes)
        p, r = precision_recall_at_k(pred_by_note, gold_raw.get("related", {}), k=5)
        metrics["related_p@5"] = p
        metrics["related_r@5"] = r
        if gold_raw.get("topic_groups"):
            metrics["topic_purity"] = topic_purity(pred_groups, gold_raw["topic_groups"])
        if gold_raw.get("confusion_pairs"):
            metrics["confusion_recall"] = confusion_recall(pred_pairs, gold_raw["confusion_pairs"])

    short = _short_summary(name, health, topics, diag, ranked)
    long = _long_summary(name, notes, health, topics, diag, signatures, ranked, metrics)
    print("\n" + short)
    print(long)
    # make sure captured output is visible
    sys_out = capsys.readouterr()
    print(sys_out.out)


def test_versioned_weights_hash():
    cfg = _cfg()
    snap_a = snapshot(cfg)
    snap_b = snapshot(cfg)
    assert snap_a["config_hash"] == snap_b["config_hash"]
    cfg2 = Config(
        db_url="postgres://test",
        fusion=FusionWeights(lexical=0.55, phrase=0.15, structural=0.15, neighborhood=0.10, recency=0.05),
        graph=cfg.graph,
        sections=cfg.sections,
        use_spacy=False,
    )
    snap_c = snapshot(cfg2)
    assert snap_a["config_hash"] != snap_c["config_hash"]


def test_topic_identity_stable_across_runs():
    _, notes, _ = biology_clean()
    cfg = _cfg()
    r1 = run_analysis(notes, cfg)

    # align second run to first
    from engine.topics.identity import PriorTopic, align
    priors = [
        PriorTopic(stable_id=t.stable_id, note_ids=t.note_ids,
                   central_note_ids=s.central_note_ids, core_terms=s.core_terms)
        for t, s in zip(r1["topics"], r1["signatures"])
    ]
    # re-run on same notes
    for n in notes:
        n.tokens = []
        n.phrases = []
        n.sections = []
        n.role = None
    r2 = run_analysis(notes, cfg, priors=priors)

    stable_ids_r1 = {t.stable_id for t in r1["topics"]}
    stable_ids_r2 = {t.stable_id for t in r2["topics"]}
    overlap = len(stable_ids_r1 & stable_ids_r2) / max(1, min(len(stable_ids_r1), len(stable_ids_r2)))
    print(f"\n[topic_identity] stable_id overlap across reruns = {overlap:.2f}")
    assert overlap >= 0.5


def test_safeguards_flags():
    from engine.safeguards import audit
    from engine.pipeline.runner import run_analysis as ra

    _, sparse_notes, _ = sparse_space()
    res = ra(sparse_notes, _cfg())
    assert "sparse_space" in res["health"].flags

    _, rep_notes, _ = repetitive_lecture()
    res = ra(rep_notes, _cfg())
    assert res["health"].repetitive_score > 0.0
