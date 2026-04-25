"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Network,
  Layers,
  AlertTriangle,
  Star,
  GitBranch,
  CircleDashed,
  CircleCheck,
  CircleAlert,
  Hash,
  Loader2,
  Sparkles,
  Link2,
  FolderTree,
  HelpCircle,
  Crown,
  Workflow,
  ScanSearch,
  Waypoints,
} from "lucide-react";

import type {
  Note,
  Space,
  SpaceRelationships,
  SemanticClusterRow,
  TopicHierarchyPathRow,
  UngroupedNoteRow,
  TypedRelationRow,
  TypedRelationKind,
  NexusInsight,
} from "@/data/types";
import { fetchSpaceRelationships } from "@/utils/supabase/queries";
import { useEngineUpdates } from "@/lib/engine-events";
import {
  useNexusSnapshot,
  useTypedRelations,
} from "@/lib/use-nexus-snapshot";

type TreeNode = {
  name: string;
  children: Map<string, TreeNode>;
  cluster?: SemanticClusterRow;
};

function buildTree(
  paths: TopicHierarchyPathRow[],
  clusters: SemanticClusterRow[],
): TreeNode {
  const root: TreeNode = { name: "", children: new Map() };
  const addPath = (path: string[], cluster?: SemanticClusterRow) => {
    let cur = root;
    for (const part of path) {
      if (!part) continue;
      let next = cur.children.get(part);
      if (!next) {
        next = { name: part, children: new Map() };
        cur.children.set(part, next);
      }
      cur = next;
    }
    if (cluster) cur.cluster = cluster;
  };
  for (const p of paths) addPath(p.path);
  for (const c of clusters) {
    if (c.hierarchy_path?.length) addPath(c.hierarchy_path, c);
    else addPath([c.parent_topic ?? "Misc", c.label ?? "Untitled"], c);
  }
  return root;
}

function Tree({
  node,
  depth,
  noteById,
  selectCluster,
  selectedId,
}: {
  node: TreeNode;
  depth: number;
  noteById: Map<string, Note>;
  selectCluster: (c: SemanticClusterRow) => void;
  selectedId: string | null;
}) {
  const children = Array.from(node.children.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  return (
    <ul
      className={
        depth === 0
          ? "space-y-0.5"
          : "space-y-0.5 border-l border-gray-200 dark:border-zinc-700 ml-2 pl-3"
      }
    >
      {children.map((child) => {
        const isLeaf = child.children.size === 0 && child.cluster;
        const isSelected = isLeaf && child.cluster?.id === selectedId;
        return (
          <li key={child.name}>
            {isLeaf ? (
              <button
                onClick={() => child.cluster && selectCluster(child.cluster)}
                className={`w-full text-left text-[11px] px-2 py-1 rounded transition-colors flex items-center justify-between gap-2 ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    : "text-zinc-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="truncate font-medium">{child.name}</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                  {child.cluster?.note_ids.length ?? 0}
                </span>
              </button>
            ) : (
              <div className="text-[11px] px-2 py-1 font-semibold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide">
                {child.name}
              </div>
            )}
            {child.children.size > 0 && (
              <Tree
                node={child}
                depth={depth + 1}
                noteById={noteById}
                selectCluster={selectCluster}
                selectedId={selectedId}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function SpaceRelationships({
  focusedSpace,
  userNotes,
}: {
  focusedSpace: Space;
  userNotes: Note[];
}) {
  const [data, setData] = useState<SpaceRelationships | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    null,
  );
  const [reloadTick, setReloadTick] = useState(0);
  useEngineUpdates((d) => {
    if (!d.space_id || d.space_id === focusedSpace.id) {
      setReloadTick((t) => t + 1);
    }
  });

  // Nexus intelligence layer (god-nodes, typed relations, insights),
  // scoped to this single space.
  const spaceIds = useMemo(() => [focusedSpace.id], [focusedSpace.id]);
  const { snapshot: nexus, status: nexusStatus } = useNexusSnapshot(spaceIds);
  const typedRelationsState = useTypedRelations(spaceIds, true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetchSpaceRelationships(focusedSpace.id);
        if (!cancelled) {
          setData(res);
          if (res.semanticClusters.length > 0) {
            setSelectedClusterId(res.semanticClusters[0].id);
          }
        }
      } catch (err) {
        console.error("fetchSpaceRelationships:", err);
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [focusedSpace.id, reloadTick]);

  const noteById = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of userNotes) m.set(n.id, n);
    return m;
  }, [userNotes]);

  const selectedCluster = useMemo(
    () =>
      data?.semanticClusters.find((c) => c.id === selectedClusterId) ?? null,
    [data, selectedClusterId],
  );

  const topicLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of data?.topics ?? []) {
      m.set(
        t.id,
        t.label ?? (t.keywords[0] ? `Topic · ${t.keywords[0]}` : "Topic"),
      );
    }
    return m;
  }, [data]);

  const tree = useMemo(() => {
    if (!data) return null;
    return buildTree(data.hierarchyPaths, data.semanticClusters);
  }, [data]);

  // Prefer note_metrics flags (richer Nexus layer) when available;
  // fall back to legacy note_diagnostics flags so the UI still renders
  // before the new pipeline has run.
  const anchors = useMemo(() => {
    if (nexus.note_metrics.length > 0) {
      return nexus.note_metrics.filter((m) => m.is_god_node);
    }
    return (data?.diagnostics ?? []).filter((d) => d.is_foundational);
  }, [nexus.note_metrics, data]);

  const bridges = useMemo(() => {
    if (nexus.note_metrics.length > 0) {
      return nexus.note_metrics.filter((m) => m.is_bridge);
    }
    return (data?.diagnostics ?? []).filter((d) => d.is_bridge);
  }, [nexus.note_metrics, data]);

  const orphans = useMemo(() => {
    if (nexus.note_metrics.length > 0) {
      return nexus.note_metrics.filter((m) => m.is_orphan);
    }
    return (data?.diagnostics ?? []).filter((d) => d.is_isolated);
  }, [nexus.note_metrics, data]);

  const cutVertices = useMemo(
    () => nexus.note_metrics.filter((m) => m.is_cut_vertex),
    [nexus.note_metrics],
  );

  const typedRelations = typedRelationsState.data ?? [];
  const typedByKind = useMemo(() => {
    const m = new Map<TypedRelationKind, TypedRelationRow[]>();
    for (const r of typedRelations) {
      const arr = m.get(r.relation) ?? [];
      arr.push(r);
      m.set(r.relation, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => b.confidence - a.confidence);
    return m;
  }, [typedRelations]);

  const insightsByKind = useMemo(() => {
    const m = new Map<NexusInsight["kind"], NexusInsight[]>();
    for (const i of nexus.insights_top) {
      const arr = m.get(i.kind) ?? [];
      arr.push(i);
      m.set(i.kind, arr);
    }
    return m;
  }, [nexus.insights_top]);
  const prereqGaps = useMemo(
    () =>
      [...(data?.diagnostics ?? [])]
        .filter((d) => d.prereq_gap > 0)
        .sort((a, b) => b.prereq_gap - a.prereq_gap)
        .slice(0, 8),
    [data],
  );

  const isEmpty =
    !loading &&
    !error &&
    data &&
    data.semanticClusters.length === 0 &&
    data.hierarchyPaths.length === 0 &&
    data.topics.length === 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-4">
      <div className="flex items-center gap-2 mb-4">
        <Network className="h-4 w-4 text-blue-500 dark:text-blue-400" />
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
          Relationships · {focusedSpace.name}
        </h2>
        {loading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 mb-3">
          {error}
        </div>
      )}

      {isEmpty && (
        <div className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-6 text-center">
          <div className="text-sm text-zinc-700 dark:text-zinc-200">
            Nothing analyzed yet for this space.
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Go to the Notes tab and click{" "}
            <span className="font-medium">Process</span> to run the engine.
          </div>
        </div>
      )}

      {data && !isEmpty && (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Topic hierarchy
              </h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-3 min-h-[280px]">
                <div className="flex items-center gap-1.5 mb-2">
                  <FolderTree className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Subjects
                  </div>
                </div>
                {tree && tree.children.size > 0 ? (
                  <Tree
                    node={tree}
                    depth={0}
                    noteById={noteById}
                    selectCluster={(c) => setSelectedClusterId(c.id)}
                    selectedId={selectedClusterId}
                  />
                ) : (
                  <Empty label="No hierarchy yet." />
                )}
              </div>

              <div className="lg:col-span-2 rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-3 min-h-[280px]">
                {selectedCluster ? (
                  <ClusterDetail
                    cluster={selectedCluster}
                    noteById={noteById}
                  />
                ) : (
                  <Empty label="Select a topic on the left." />
                )}
              </div>
            </div>
          </div>

          {data.ungrouped.length > 0 && (
            <div className="mb-4">
              <Section
                icon={HelpCircle}
                title={`Ungrouped (${data.ungrouped.length})`}
              >
                <ul className="space-y-1">
                  {data.ungrouped.map((u) => (
                    <UngroupedRow key={u.note_id} row={u} />
                  ))}
                </ul>
              </Section>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <Network className="h-3.5 w-3.5 text-zinc-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Algorithmic signals
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section
              icon={Link2}
              title={`Top Semantic Edges (${data.semanticEdges.length})`}
            >
              {data.semanticEdges.length === 0 ? (
                <Empty label="No embedding edges." />
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {data.semanticEdges.slice(0, 20).map((e) => (
                    <li
                      key={`${e.src_note_id}-${e.dst_note_id}`}
                      className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 truncate"
                    >
                      <span className="truncate flex-1 min-w-0">
                        {noteById.get(e.src_note_id)?.title ??
                          e.src_note_id.slice(0, 6)}
                      </span>
                      <span
                        className="text-zinc-400 flex-shrink-0"
                        title={e.mutual ? "mutual kNN" : "one-way kNN"}
                      >
                        {e.mutual ? "↔" : "→"}
                      </span>
                      <span className="truncate flex-1 min-w-0">
                        {noteById.get(e.dst_note_id)?.title ??
                          e.dst_note_id.slice(0, 6)}
                      </span>
                      <span className="ml-auto text-zinc-400 flex-shrink-0">
                        {(e.similarity * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              icon={AlertTriangle}
              title={`Confusion Pairs (${data.confusion.length})`}
            >
              {data.confusion.length === 0 ? (
                <Empty label="No confusion pairs detected." />
              ) : (
                <ul className="space-y-2">
                  {data.confusion.slice(0, 8).map((p) => (
                    <li
                      key={`${p.topic_a}-${p.topic_b}`}
                      className="rounded-md border border-gray-100/80 dark:border-zinc-800 p-2"
                    >
                      <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-100 truncate">
                        {topicLabelById.get(p.topic_a) ?? p.topic_a.slice(0, 6)}{" "}
                        <span className="text-zinc-400">↔</span>{" "}
                        {topicLabelById.get(p.topic_b) ?? p.topic_b.slice(0, 6)}
                      </div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        score {p.score.toFixed(2)} · close{" "}
                        {p.closeness.toFixed(2)} · sep{" "}
                        {p.separability.toFixed(2)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section icon={Crown} title={`Anchors / God-nodes (${anchors.length})`}>
              {anchors.length === 0 ? (
                <Empty label="No anchor notes — engine analysis not run yet." />
              ) : (
                <MetricNoteList
                  rows={anchors}
                  noteById={noteById}
                  format={(r) =>
                    "pagerank" in r
                      ? `pr ${r.pagerank.toFixed(3)} · deg ${r.degree}`
                      : null
                  }
                />
              )}
            </Section>

            <Section icon={GitBranch} title={`Bridges (${bridges.length})`}>
              {bridges.length === 0 ? (
                <Empty label="No bridge notes detected." />
              ) : (
                <MetricNoteList
                  rows={bridges}
                  noteById={noteById}
                  format={(r) =>
                    "betweenness" in r ? `bw ${r.betweenness.toFixed(3)}` : null
                  }
                />
              )}
            </Section>

            <Section
              icon={CircleDashed}
              title={`Orphans (${orphans.length})`}
            >
              {orphans.length === 0 ? (
                <Empty label="No orphan notes." />
              ) : (
                <MetricNoteList
                  rows={orphans}
                  noteById={noteById}
                  format={() => null}
                />
              )}
            </Section>

            <Section
              icon={Waypoints}
              title={`Cut vertices (${cutVertices.length})`}
            >
              {cutVertices.length === 0 ? (
                <Empty label="No fragility points — graph stays connected without any single note." />
              ) : (
                <MetricNoteList
                  rows={cutVertices}
                  noteById={noteById}
                  format={(r) =>
                    "betweenness" in r ? `bw ${r.betweenness.toFixed(3)}` : null
                  }
                />
              )}
            </Section>

            <Section
              icon={AlertTriangle}
              title={`Prerequisite Gaps (${prereqGaps.length})`}
            >
              {prereqGaps.length === 0 ? (
                <Empty label="No prerequisite gaps." />
              ) : (
                <NoteList
                  rows={prereqGaps}
                  noteById={noteById}
                  metric={(r) => r.prereq_gap.toFixed(2)}
                />
              )}
            </Section>

            <Section icon={Hash} title={`Concept Hubs (${data.hubs.length})`}>
              {data.hubs.length === 0 ? (
                <Empty label="No concept hubs." />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {data.hubs.slice(0, 30).map((h) => (
                    <span
                      key={h.term}
                      className="text-[11px] rounded-full px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40"
                    >
                      {h.term}
                      <span className="ml-1 opacity-60">{h.degree}</span>
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section
              icon={Layers}
              title={`Algorithmic Topics (${data.topics.length})`}
            >
              {data.topics.length === 0 ? (
                <Empty label="No algorithmic topics." />
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {data.topics.slice(0, 8).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 truncate"
                    >
                      <span className="truncate">
                        {t.label ?? t.keywords[0] ?? "Topic"}
                      </span>
                      <span className="ml-auto text-[10px] text-zinc-400">
                        {t.note_ids.length} notes
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              icon={Workflow}
              title={`Typed relations (${typedRelations.length})`}
            >
              {typedRelationsState.status === "loading" ? (
                <Empty label="Loading typed relations…" />
              ) : typedRelations.length === 0 ? (
                <Empty label="No typed relations extracted yet." />
              ) : (
                <ul className="space-y-2 text-[11px]">
                  {[...typedByKind.entries()].map(([kind, rows]) => (
                    <li key={kind}>
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-0.5">
                        {kind.replace("_", " ")} · {rows.length}
                      </div>
                      <ul className="space-y-0.5">
                        {rows.slice(0, 4).map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300"
                            title={r.evidence || undefined}
                          >
                            <span className="truncate flex-1 min-w-0">
                              {noteById.get(r.src_note_id ?? "")?.title ??
                                (r.src_note_id ?? "?").slice(0, 6)}
                            </span>
                            <span className="text-zinc-400 flex-shrink-0">→</span>
                            <span className="truncate flex-1 min-w-0">
                              {noteById.get(r.dst_note_id ?? "")?.title ??
                                (r.dst_note_id ?? "?").slice(0, 6)}
                            </span>
                            <span className="ml-auto text-[10px] text-zinc-400 flex-shrink-0">
                              {(r.confidence * 100).toFixed(0)}%
                              <span className="ml-1 opacity-60">{r.source}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              icon={Sparkles}
              title={`Nexus insights (${nexus.insights_top.length})`}
            >
              {nexusStatus === "loading" ? (
                <Empty label="Loading insights…" />
              ) : nexus.insights_top.length === 0 ? (
                <Empty label="No surfaced insights yet — re-run engine." />
              ) : (
                <ul className="space-y-2 text-[11px]">
                  {[...insightsByKind.entries()].map(([kind, items]) => (
                    <li key={kind}>
                      <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-0.5">
                        {kind} · {items.length}
                      </div>
                      <ul className="space-y-0.5 text-zinc-600 dark:text-zinc-300">
                        {items.slice(0, 3).map((i) => (
                          <li key={i.id} className="truncate">
                            {summarizeInsight(i)}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              icon={ScanSearch}
              title={`Concept reach (${(insightsByKind.get("reach") ?? []).length})`}
            >
              {(insightsByKind.get("reach") ?? []).length === 0 ? (
                <Empty label="No cross-community concepts." />
              ) : (
                <ul className="space-y-1 text-[11px] text-zinc-700 dark:text-zinc-200">
                  {(insightsByKind.get("reach") ?? []).slice(0, 8).map((i) => {
                    const p = i.payload || {};
                    const surface =
                      typeof p["surface"] === "string"
                        ? (p["surface"] as string)
                        : "";
                    const comms = Array.isArray(p["communities"])
                      ? (p["communities"] as unknown[]).length
                      : 0;
                    const noteCount =
                      typeof p["note_count"] === "number"
                        ? (p["note_count"] as number)
                        : 0;
                    return (
                      <li key={i.id} className="flex items-center gap-2 truncate">
                        <span className="truncate font-medium">{surface || "concept"}</span>
                        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                          {comms} communities · {noteCount} notes
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section
              icon={GitBranch}
              title={`Prereq Edges (${data.prereqEdges.length})`}
            >
              {data.prereqEdges.length === 0 ? (
                <Empty label="No directional prerequisite edges." />
              ) : (
                <ul className="space-y-1 text-[11px]">
                  {data.prereqEdges.slice(0, 12).map((e) => (
                    <li
                      key={`${e.src_node_id}-${e.dst_node_id}`}
                      className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300 truncate"
                    >
                      <span className="truncate">
                        {noteById.get(e.src_node_id)?.title ??
                          e.src_node_id.slice(0, 6)}
                      </span>
                      <span className="text-zinc-400 flex-shrink-0">→</span>
                      <span className="truncate">
                        {noteById.get(e.dst_node_id)?.title ??
                          e.dst_node_id.slice(0, 6)}
                      </span>
                      <span className="ml-auto text-zinc-400 flex-shrink-0">
                        {e.weight.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function ClusterDetail({
  cluster,
  noteById,
}: {
  cluster: SemanticClusterRow;
  noteById: Map<string, Note>;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {cluster.hierarchy_path.slice(0, -1).join(" / ") ||
            cluster.parent_topic ||
            "Topic"}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {cluster.label ?? "Untitled topic"}
          </h3>
          <span className="rounded px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-300">
            {cluster.note_ids.length} notes
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            coh {(cluster.cohesion * 100).toFixed(0)}%
          </span>
          {cluster.llm_confidence > 0 && (
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              conf {(cluster.llm_confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {cluster.evidence_terms.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <Star className="h-3 w-3" />
              Evidence
            </div>
            <div className="flex flex-wrap gap-1">
              {cluster.evidence_terms.slice(0, 12).map((t) => (
                <span
                  key={t}
                  className="text-[10.5px] rounded-full px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-[#0061ff] dark:text-blue-300 border border-blue-100 dark:border-blue-900/40"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {cluster.excluded_terms.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
              <CircleAlert className="h-3 w-3" />
              Dropped as noise
            </div>
            <div className="flex flex-wrap gap-1">
              {cluster.excluded_terms.slice(0, 10).map((t) => (
                <span
                  key={t}
                  className="text-[10.5px] rounded-full px-2 py-0.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300 border border-rose-200/70 dark:border-rose-900/40 line-through opacity-80"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {cluster.secondary_topics.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            Related clusters
          </div>
          <div className="flex flex-wrap gap-1">
            {cluster.secondary_topics.map((t) => (
              <span
                key={t}
                className="text-[10.5px] rounded-full px-2 py-0.5 bg-gray-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-gray-100 dark:border-zinc-700 inline-flex items-center gap-1"
              >
                <CircleCheck className="h-2.5 w-2.5 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-1">
        <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">
          Notes
        </div>
        <ul className="space-y-0.5">
          {cluster.note_ids.map((nid) => {
            const n = noteById.get(nid);
            return (
              <li
                key={nid}
                className="text-[11px] text-zinc-700 dark:text-zinc-200 truncate"
              >
                · {n?.title || nid.slice(0, 8)}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function UngroupedRow({ row }: { row: UngroupedNoteRow }) {
  return (
    <li className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300 truncate">
      <CircleDashed className="h-3 w-3 text-zinc-400 flex-shrink-0" />
      <span className="truncate font-medium">{row.title || row.note_id.slice(0, 8)}</span>
      <span className="text-zinc-400 dark:text-zinc-500 truncate flex-1 min-w-0">
        — {row.reason}
      </span>
    </li>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
      {label}
    </div>
  );
}

type NoteRowLike =
  | { note_id: string; prereq_gap: number; integration: number }
  | {
      note_id: string;
      pagerank: number;
      betweenness: number;
      degree: number;
    };

function MetricNoteList({
  rows,
  noteById,
  format,
}: {
  rows: NoteRowLike[];
  noteById: Map<string, Note>;
  format: (r: NoteRowLike) => string | null;
}) {
  return (
    <ul className="space-y-1">
      {rows.slice(0, 12).map((r) => {
        const n = noteById.get(r.note_id);
        const label = format(r);
        return (
          <li
            key={r.note_id}
            className="flex items-center justify-between gap-2 text-[11px] text-zinc-700 dark:text-zinc-200"
          >
            <span className="truncate">
              {n?.title || r.note_id.slice(0, 8)}
            </span>
            {label && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function summarizeInsight(i: NexusInsight): string {
  const p = i.payload || {};
  switch (i.kind) {
    case "bridge":
    case "god":
      return typeof p["title"] === "string" ? (p["title"] as string) : "untitled";
    case "orphan": {
      const c = typeof p["count"] === "number" ? (p["count"] as number) : 0;
      return `${c} disconnected note${c === 1 ? "" : "s"}`;
    }
    case "contradiction": {
      const a =
        typeof p["src_title"] === "string" ? (p["src_title"] as string) : "?";
      const b =
        typeof p["dst_title"] === "string" ? (p["dst_title"] as string) : "?";
      return `${a} ↔ ${b}`;
    }
    case "chain": {
      const t = Array.isArray(p["titles"]) ? (p["titles"] as string[]) : [];
      return t.length ? t.join(" → ") : "dependency chain";
    }
    case "reach": {
      const surface =
        typeof p["surface"] === "string" ? (p["surface"] as string) : "concept";
      const c = Array.isArray(p["communities"])
        ? (p["communities"] as unknown[]).length
        : 0;
      return `“${surface}” spans ${c} communities`;
    }
    case "emerging":
      return typeof p["label"] === "string"
        ? (p["label"] as string)
        : "new cluster";
    default:
      return "";
  }
}

function NoteList({
  rows,
  noteById,
  metric,
}: {
  rows: { note_id: string; prereq_gap: number; integration: number }[];
  noteById: Map<string, Note>;
  metric: ((r: { prereq_gap: number; integration: number }) => string) | null;
}) {
  return (
    <ul className="space-y-1">
      {rows.slice(0, 12).map((r) => {
        const n = noteById.get(r.note_id);
        return (
          <li
            key={r.note_id}
            className="flex items-center justify-between gap-2 text-[11px] text-zinc-700 dark:text-zinc-200"
          >
            <span className="truncate">
              {n?.title || r.note_id.slice(0, 8)}
            </span>
            {metric && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                {metric(r)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
