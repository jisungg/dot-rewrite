"""Lightweight topic labeler.

Local algorithms (embeddings + Leiden) already produced clusters. This
module does ONE thing:

    given a cluster summary (keywords + titles + short excerpts)
    → return a concrete topic label

It is deliberately tiny:
- Cheap model (Haiku) — labeling is a small task, not a reasoning task.
- Batch: all clusters for a space go in one call, not one call per cluster.
- Minimal payload per cluster: 6 keywords, up to 5 titles, up to 3 excerpts
  capped at 160 chars each. Never full note bodies.
- Strict output schema: `{labels: [{cluster_id, topic, parent_topic}]}`.
- Cacheable system rubric (prompt-cached prefix) so repeat runs for the
  same space read from cache.
- Fail-soft: missing key, API error, or parse failure → return None and
  keep algorithmic keyword labels.

It does NOT:
- re-partition notes (no merging, no splitting, no moving notes)
- generate note summaries (see `summarizer.py` for on-demand summaries)
- request or require full note content
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

from ..config import LLMLabelerParams
from ..ingest import markdown as md
from ..models import NoteRecord, SemanticCluster
from . import backend

log = logging.getLogger("engine.llm.labeler")


SYSTEM_RUBRIC = """You are a lightweight, rate-limited topic labeling assistant.

You do not cluster, group, split, merge, or summarize. Those steps already happened locally.

Your ONLY job: given a small cluster summary, return one clean, concrete, human-readable topic label for each cluster.

RULES:

1. Output one topic name per cluster. 2–5 words when possible.
2. Labels must be concrete, specific, recognizable, and use standard academic terminology when possible.
3. Also return a parent_topic — the broader subject the cluster belongs to (e.g. "Mathematics", "Computer Science", "Biology", "Modern European History", "American Literature"). If the subject is unclear, use "General".
4. Ignore markdown, LaTeX formatting commands, code boilerplate, and generic note words (note, example, section, definition, summary, etc).
5. Do not merge or split clusters. Label each cluster independently.
6. If the input is too vague to label, return "Unclear Topic" with parent_topic "General" — never guess.

GOOD: "Vector Projections", "Dot Product", "Bayes' Theorem", "React Components", "Photosynthesis", "Causes of World War I".
BAD: "projection dot vector", "math stuff", "notes about vectors", "proj onto"."""


OUTPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "labels": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "cluster_id": {"type": "string"},
                    "topic": {"type": "string"},
                    "parent_topic": {"type": "string"},
                },
                "required": ["cluster_id", "topic", "parent_topic"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["labels"],
    "additionalProperties": False,
}


@dataclass
class LabelPatch:
    cluster_id: str
    topic: str
    parent_topic: str


def _excerpt(n: NoteRecord, limit: int) -> str:
    text = md.clean(n.raw_text).strip()
    if not text:
        return ""
    text = " ".join(text.split())  # collapse whitespace
    if len(text) > limit:
        text = text[: limit - 1] + "…"
    return text


def _cluster_payload(
    c: SemanticCluster,
    notes_by_id: dict[str, NoteRecord],
    params: LLMLabelerParams,
) -> dict[str, Any]:
    titles: list[str] = []
    excerpts: list[str] = []
    for nid in c.note_ids:
        n = notes_by_id.get(nid)
        if not n:
            continue
        if len(titles) < params.max_titles_per_cluster and n.title.strip():
            titles.append(n.title.strip())
        if len(excerpts) < params.max_excerpts_per_cluster:
            ex = _excerpt(n, params.max_excerpt_chars)
            if ex:
                excerpts.append(ex)
        if (
            len(titles) >= params.max_titles_per_cluster
            and len(excerpts) >= params.max_excerpts_per_cluster
        ):
            break
    return {
        "cluster_id": c.id,
        "keywords": list(c.keywords)[: params.max_keywords_per_cluster],
        "note_titles": titles,
        "sample_excerpts": excerpts,
    }


def _call(
    clusters_payload: list[dict[str, Any]], params: LLMLabelerParams
) -> list[LabelPatch] | None:
    parsed = backend.complete_json(
        system=SYSTEM_RUBRIC,
        user=json.dumps({"clusters": clusters_payload}, ensure_ascii=False),
        schema=OUTPUT_SCHEMA,
        task="labeler",
        max_tokens=2000,
        anthropic_default_model=params.model,
    )
    if parsed is None:
        return None

    out: list[LabelPatch] = []
    for item in parsed.get("labels", []):
        cid = (item.get("cluster_id") or "").strip()
        topic = (item.get("topic") or "").strip()
        parent = (item.get("parent_topic") or "").strip() or "General"
        if cid and topic:
            out.append(LabelPatch(cluster_id=cid, topic=topic, parent_topic=parent))
    return out


def label(
    notes: list[NoteRecord],
    clusters: list[SemanticCluster],
    params: LLMLabelerParams,
) -> list[LabelPatch] | None:
    """Return a list of LabelPatch, one per cluster. None on failure."""
    if not backend.available():
        log.info(
            "llm labeler skipped: backend=%s not configured", backend.backend_name(),
        )
        return None
    if not clusters:
        return []

    notes_by_id = {n.id: n for n in notes}
    payloads = [_cluster_payload(c, notes_by_id, params) for c in clusters]

    patches: list[LabelPatch] = []
    for i in range(0, len(payloads), params.max_clusters_per_call):
        chunk = payloads[i : i + params.max_clusters_per_call]
        result = _call(chunk, params)
        if result is None:
            # Fail-soft: skip this chunk but keep any prior successes.
            continue
        patches.extend(result)
    return patches


def apply_patches(
    clusters: list[SemanticCluster], patches: list[LabelPatch]
) -> int:
    """Apply labels in place. Returns number of clusters updated."""
    by_id = {p.cluster_id: p for p in patches}
    updated = 0
    for c in clusters:
        p = by_id.get(c.id)
        if p is None:
            continue
        c.label = p.topic
        c.parent_topic = p.parent_topic or None
        c.hierarchy_path = (
            [p.parent_topic, p.topic] if p.parent_topic else [p.topic]
        )
        c.source = "llm_labeled"
        updated += 1
    return updated
