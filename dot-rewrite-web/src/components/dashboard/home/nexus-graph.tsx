"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import { polygonHull } from "d3";
import type {
  NexusSnapshot,
  NexusSnapshotNote,
  NoteMetricsRow,
  TypedRelationRow,
  TypedRelationKind,
  Space,
} from "@/data/types";

// react-force-graph-2d uses the canvas API which is browser-only; load
// it lazily so SSR doesn't try to evaluate it.
const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d").then((m) => m.default),
  { ssr: false },
) as unknown as React.ComponentType<NexusForceGraphProps>;

// ---------- types ----------

export type NexusGraphLayer =
  | "similarity"
  | "prereq"
  | "confusion"
  | "typed"
  | "hulls"
  | "godHalos";

export type NexusGraphFilters = {
  activeSpaceId: string | "all";
  search: string;
  activeTag: string | null;
  activeCommunityId: string | null;
  highlightedNoteIds: Set<string> | null;
  layers: Record<NexusGraphLayer, boolean>;
};

export type NexusGraphHandle = {
  focusNotes: (noteIds: string[]) => void;
  resetZoom: () => void;
  zoomBy: (factor: number) => void;
};

type NexusGraphProps = {
  snapshot: NexusSnapshot;
  spaces: Space[];
  filters: NexusGraphFilters;
  typedRelations: TypedRelationRow[] | null;
  onNodeClick?: (note: NexusSnapshotNote) => void;
};

// ForceGraph2D's full type surface is enormous. We narrow to the fields
// we actually use — keeps strict mode happy without bringing in the
// renderer's types at SSR time.
type NexusForceGraphProps = {
  ref?: React.Ref<unknown>;
  graphData: { nodes: GraphNode[]; links: GraphLink[] };
  width: number;
  height: number;
  backgroundColor?: string;
  cooldownTicks?: number;
  warmupTicks?: number;
  d3AlphaDecay?: number;
  d3VelocityDecay?: number;
  enableNodeDrag?: boolean;
  nodeRelSize?: number;
  linkDirectionalArrowLength?: (l: GraphLink) => number;
  linkDirectionalArrowRelPos?: number;
  linkColor?: (l: GraphLink) => string;
  linkWidth?: (l: GraphLink) => number;
  linkLineDash?: (l: GraphLink) => number[] | null;
  linkLabel?: (l: GraphLink) => string;
  nodeLabel?: (n: GraphNode) => string;
  nodeCanvasObject?: (
    node: GraphNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => void;
  nodePointerAreaPaint?: (
    node: GraphNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => void;
  onRenderFramePre?: (ctx: CanvasRenderingContext2D, globalScale: number) => void;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onEngineStop?: () => void;
};

type GraphNode = {
  id: string;
  title: string;
  space_id: string;
  tags: string[];
  metric: NoteMetricsRow | null;
  color: string;
  radius: number;
  isGod: boolean;
  isOrphan: boolean;
  isBridge: boolean;
  highlighted: boolean;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
};

type EdgeKind = "semantic" | "prereq" | "confusion" | TypedRelationKind;

type GraphLink = {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  kind: EdgeKind;
  evidence?: string;
};

// ---------- color helpers ----------

const TYPED_RELATION_COLORS: Record<TypedRelationKind, string> = {
  causes: "#9333ea",         // purple-600
  depends_on: "#f97316",     // orange-500
  contradicts: "#dc2626",    // red-600
  elaborates: "#0ea5e9",     // sky-500
  defines: "#10b981",        // emerald-500
  exemplifies: "#a855f7",    // purple-500
  is_a: "#14b8a6",           // teal-500
  part_of: "#f59e0b",        // amber-500
};

// 16-color qualitative palette for community coloring (Tableau-like).
const COMMUNITY_PALETTE = [
  "#4e79a7", "#f28e2b", "#e15759", "#76b7b2",
  "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
  "#9c755f", "#bab0ac", "#7c5295", "#1f9d55",
  "#d62728", "#9467bd", "#8c564b", "#17becf",
];

function colorForCommunity(communityId: string | null, fallback: string): string {
  if (!communityId) return fallback;
  let h = 0;
  for (let i = 0; i < communityId.length; i++) {
    h = (h * 31 + communityId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % COMMUNITY_PALETTE.length;
  return COMMUNITY_PALETTE[idx];
}

function withAlpha(hex: string, alpha: number): string {
  // Accept #RRGGBB only.
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- component ----------

const NexusGraphInner = forwardRef<NexusGraphHandle, NexusGraphProps>(
  function NexusGraphInner(
    { snapshot, spaces, filters, typedRelations, onNodeClick },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const fgRef = useRef<{
      zoomToFit?: (ms: number, padding: number) => void;
      centerAt?: (x: number, y: number, ms?: number) => void;
      zoom?: (factor?: number, ms?: number) => number | void;
      d3ReheatSimulation?: () => void;
    } | null>(null);
    const positionCacheRef = useRef<Map<string, { x: number; y: number }>>(
      new Map(),
    );
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    // Resize observer.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        setDimensions({
          width: Math.max(200, el.offsetWidth),
          height: Math.max(200, el.offsetHeight),
        });
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      window.addEventListener("resize", update);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", update);
      };
    }, []);

    // Index helpers.
    const metricsById = useMemo(() => {
      const m = new Map<string, NoteMetricsRow>();
      for (const row of snapshot.note_metrics) m.set(row.note_id, row);
      return m;
    }, [snapshot.note_metrics]);

    const spaceColorById = useMemo(() => {
      const m = new Map<string, string>();
      for (const s of spaces) m.set(s.id, s.color);
      return m;
    }, [spaces]);

    // Derive nodes from snapshot + filters.
    const nodes: GraphNode[] = useMemo(() => {
      const out: GraphNode[] = [];
      const term = filters.search.trim().toLowerCase();
      for (const note of snapshot.notes) {
        if (filters.activeSpaceId !== "all" && note.space_id !== filters.activeSpaceId) {
          continue;
        }
        if (filters.activeTag && !note.tags.includes(filters.activeTag)) continue;
        if (term) {
          const t = note.title.toLowerCase();
          const tagsHit = note.tags.some((tg) => tg.toLowerCase().includes(term));
          if (!t.includes(term) && !tagsHit) continue;
        }
        const metric = metricsById.get(note.id) ?? null;
        if (
          filters.activeCommunityId &&
          metric?.community_id !== filters.activeCommunityId
        ) {
          continue;
        }
        const fallback = spaceColorById.get(note.space_id) ?? "#94a3b8";
        const color = colorForCommunity(metric?.community_id ?? null, fallback);
        const isGod = !!metric?.is_god_node && filters.layers.godHalos;
        const isOrphan = !!metric?.is_orphan;
        const isBridge = !!metric?.is_bridge;
        const cached = positionCacheRef.current.get(note.id);
        out.push({
          id: note.id,
          title: note.title,
          space_id: note.space_id,
          tags: note.tags,
          metric,
          color,
          radius: isGod ? 8 : isBridge ? 6 : 5,
          isGod,
          isOrphan,
          isBridge,
          highlighted: filters.highlightedNoteIds?.has(note.id) ?? false,
          x: cached?.x,
          y: cached?.y,
        });
      }
      return out;
    }, [
      snapshot.notes,
      metricsById,
      spaceColorById,
      filters.activeSpaceId,
      filters.activeTag,
      filters.search,
      filters.activeCommunityId,
      filters.highlightedNoteIds,
      filters.layers.godHalos,
    ]);

    // Derive links from snapshot + typed relations + filters.
    const links: GraphLink[] = useMemo(() => {
      const visible = new Set(nodes.map((n) => n.id));
      const out: GraphLink[] = [];
      if (filters.layers.similarity) {
        for (const e of snapshot.semantic_edges) {
          if (!visible.has(e.src_note_id) || !visible.has(e.dst_note_id)) continue;
          out.push({
            source: e.src_note_id,
            target: e.dst_note_id,
            value: Math.max(0.1, e.similarity),
            kind: "semantic",
          });
        }
      }
      if (filters.layers.prereq) {
        for (const e of snapshot.prereq_edges) {
          if (!visible.has(e.src_node_id) || !visible.has(e.dst_node_id)) continue;
          out.push({
            source: e.src_node_id,
            target: e.dst_node_id,
            value: Math.max(0.18, e.weight ?? 0.4),
            kind: "prereq",
          });
        }
      }
      if (filters.layers.confusion && snapshot.confusion_pairs.length > 0) {
        // Map cluster ids to a representative note id present in `nodes`.
        const clusterRep = new Map<string, string>();
        for (const c of snapshot.semantic_clusters) {
          const rep = c.note_ids.find((id) => visible.has(id));
          if (rep) clusterRep.set(c.id, rep);
        }
        for (const cp of snapshot.confusion_pairs) {
          const a = clusterRep.get(cp.topic_a);
          const b = clusterRep.get(cp.topic_b);
          if (!a || !b || a === b) continue;
          out.push({
            source: a,
            target: b,
            value: Math.max(0.18, Math.min(1, cp.score ?? 0.4)),
            kind: "confusion",
          });
        }
      }
      if (filters.layers.typed && typedRelations) {
        for (const r of typedRelations) {
          if (!r.src_note_id || !r.dst_note_id) continue;
          if (!visible.has(r.src_note_id) || !visible.has(r.dst_note_id)) continue;
          out.push({
            source: r.src_note_id,
            target: r.dst_note_id,
            value: Math.max(0.18, r.confidence),
            kind: r.relation,
            evidence: r.evidence,
          });
        }
      }
      return out;
    }, [
      nodes,
      snapshot.semantic_edges,
      snapshot.prereq_edges,
      snapshot.confusion_pairs,
      snapshot.semantic_clusters,
      typedRelations,
      filters.layers.similarity,
      filters.layers.prereq,
      filters.layers.confusion,
      filters.layers.typed,
    ]);

    // Compute community hulls from current node positions during render.
    const hullCommunities = useMemo(() => {
      if (!filters.layers.hulls) return [];
      const labelByCommunity = new Map<string, string>();
      for (const c of snapshot.semantic_clusters) {
        const id = c.stable_id ?? c.id;
        if (c.label) labelByCommunity.set(id, c.label);
      }
      const groups = new Map<string, GraphNode[]>();
      for (const n of nodes) {
        const cid = n.metric?.community_id ?? null;
        if (!cid) continue;
        const arr = groups.get(cid) ?? [];
        arr.push(n);
        groups.set(cid, arr);
      }
      return [...groups.entries()]
        .filter(([, members]) => members.length >= 3)
        .map(([cid, members]) => ({
          id: cid,
          label: labelByCommunity.get(cid) ?? "",
          members,
          color: colorForCommunity(cid, "#94a3b8"),
        }));
    }, [filters.layers.hulls, snapshot.semantic_clusters, nodes]);

    // Imperative API.
    useImperativeHandle(
      ref,
      () => ({
        focusNotes: (ids: string[]) => {
          const matched = nodes.filter(
            (n) =>
              ids.includes(n.id) && typeof n.x === "number" && typeof n.y === "number",
          );
          if (matched.length === 0) return;
          const xs = matched.map((n) => n.x as number);
          const ys = matched.map((n) => n.y as number);
          const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
          const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
          fgRef.current?.centerAt?.(cx, cy, 600);
          fgRef.current?.zoom?.(2.2, 600);
        },
        resetZoom: () => fgRef.current?.zoomToFit?.(400, 60),
        zoomBy: (factor: number) => {
          const z = fgRef.current?.zoom?.();
          if (typeof z === "number") {
            fgRef.current?.zoom?.(Math.max(0.1, Math.min(8, z * factor)), 250);
          }
        },
      }),
      [nodes],
    );

    // Persist node positions when the simulation ends.
    const handleEngineStop = () => {
      for (const n of nodes) {
        if (typeof n.x === "number" && typeof n.y === "number") {
          positionCacheRef.current.set(n.id, { x: n.x, y: n.y });
        }
      }
      fgRef.current?.zoomToFit?.(400, 60);
    };

    // Background hull pass — drawn behind nodes via onRenderFramePre.
    const drawHulls = (ctx: CanvasRenderingContext2D) => {
      if (!filters.layers.hulls) return;
      for (const grp of hullCommunities) {
        const pts: [number, number][] = grp.members
          .filter(
            (n) => typeof n.x === "number" && typeof n.y === "number",
          )
          .map((n) => [n.x as number, n.y as number]);
        if (pts.length < 3) continue;
        const hull = polygonHull(pts);
        if (!hull || hull.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(hull[0][0], hull[0][1]);
        for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
        ctx.closePath();
        ctx.fillStyle = withAlpha(grp.color, 0.10);
        ctx.fill();
        ctx.strokeStyle = withAlpha(grp.color, 0.6);
        ctx.lineWidth = 1;
        ctx.stroke();
        if (grp.label) {
          const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
          const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
          ctx.fillStyle = withAlpha(grp.color, 0.85);
          ctx.font = "11px ui-sans-serif, system-ui";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(grp.label, cx, cy - 6);
        }
      }
    };

    return (
      <div ref={containerRef} className="w-full h-full">
        <ForceGraph2D
          ref={fgRef as unknown as React.Ref<unknown>}
          graphData={{ nodes, links }}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={120}
          warmupTicks={20}
          d3AlphaDecay={0.05}
          d3VelocityDecay={0.3}
          enableNodeDrag
          nodeRelSize={5}
          onEngineStop={handleEngineStop}
          onRenderFramePre={drawHulls}
          linkColor={(l) => {
            if (l.kind === "prereq") return "#f97316";
            if (l.kind === "confusion") return "#dc2626";
            if (l.kind === "semantic") {
              if (l.value >= 0.65) return "#2563eb";
              if (l.value >= 0.4) return "#60a5fa";
              return "#cbd5e1";
            }
            return TYPED_RELATION_COLORS[l.kind as TypedRelationKind] ?? "#a3a3a3";
          }}
          linkWidth={(l) => Math.max(0.6, Math.sqrt(l.value * 4))}
          linkLineDash={(l) => (l.kind === "confusion" ? [4, 3] : null)}
          linkDirectionalArrowLength={(l) =>
            l.kind === "prereq" || l.kind === "depends_on" ? 4 : 0
          }
          linkDirectionalArrowRelPos={1}
          linkLabel={(l) => {
            const src = typeof l.source === "object" ? l.source.title : l.source;
            const dst = typeof l.target === "object" ? l.target.title : l.target;
            if (l.kind === "semantic") return `${src} ↔ ${dst} · similarity ${(l.value * 100).toFixed(0)}%`;
            const evid = l.evidence ? `\n${l.evidence}` : "";
            return `${src} → ${dst} · ${l.kind}${evid}`;
          }}
          nodeLabel={(n) =>
            `${n.title}${n.tags.length ? "\n#" + n.tags.join(" #") : ""}`
          }
          nodeCanvasObject={(node, ctx, globalScale) => {
            const r = node.radius;
            const labelOpacity = node.isGod || node.highlighted ? 1 : 0;
            // Halo for god-nodes.
            if (node.isGod) {
              ctx.beginPath();
              ctx.arc(node.x ?? 0, node.y ?? 0, r + 5, 0, 2 * Math.PI);
              ctx.fillStyle = withAlpha(node.color, 0.18);
              ctx.fill();
            }
            // Bridge marker = square outline.
            if (node.isBridge) {
              ctx.strokeStyle = node.color;
              ctx.lineWidth = 1.4;
              ctx.strokeRect((node.x ?? 0) - r - 2, (node.y ?? 0) - r - 2, r * 2 + 4, r * 2 + 4);
            }
            // Body.
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
            ctx.fillStyle = node.isOrphan ? withAlpha(node.color, 0.45) : node.color;
            ctx.fill();
            if (node.isOrphan) {
              ctx.setLineDash([2, 2]);
              ctx.strokeStyle = withAlpha(node.color, 0.7);
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.setLineDash([]);
            } else if (node.highlighted) {
              ctx.strokeStyle = "#facc15"; // yellow-400 ring
              ctx.lineWidth = 2;
              ctx.stroke();
            } else {
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 1;
              ctx.stroke();
            }
            if (labelOpacity > 0 && globalScale > 0.8) {
              ctx.fillStyle = withAlpha("#0f172a", labelOpacity);
              ctx.font = `${Math.max(10, 11 / Math.max(0.5, globalScale))}px ui-sans-serif, system-ui`;
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              ctx.fillText(node.title || "Untitled", (node.x ?? 0) + r + 6, node.y ?? 0);
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, node.radius + 4, 0, 2 * Math.PI);
            ctx.fill();
          }}
          onNodeClick={(node) => {
            if (!onNodeClick) return;
            onNodeClick({
              id: node.id,
              title: node.title,
              space_id: node.space_id,
              tags: node.tags,
            });
          }}
        />
      </div>
    );
  },
);

export default NexusGraphInner;
