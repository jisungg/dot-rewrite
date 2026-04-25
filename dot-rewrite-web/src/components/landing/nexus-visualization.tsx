"use client";

import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";

// Scaled-down replica of the dashboard's Nexus tab. The real product
// renders one circle per note, colored by its parent topic / semantic
// cluster, and overlays three typed edge layers — similarity, prereq
// dependencies (directional), confusion (dashed). No note/concept/question
// node typing — every node is a note.

type Note = {
  id: string;
  title: string;
  parent: keyof typeof clusterMeta;
  tags?: string[];
  recent?: boolean;
};

type EdgeKind = "similarity" | "prereq" | "confusion";

interface Edge {
  source: string;
  target: string;
  kind: EdgeKind;
  strength: number; // 0–1 for similarity, ~weight otherwise
}

const clusterMeta = {
  linalg: { label: "Linear Algebra", color: "#0061ff" },
  calc: { label: "Calculus", color: "#22b8cf" },
  prob: { label: "Probability", color: "#a855f7" },
} as const;

const notes: Note[] = [
  // Linear algebra cluster
  { id: "ln-vectors", title: "Vectors", parent: "linalg", tags: ["basis"] },
  {
    id: "ln-dot",
    title: "Dot Product",
    parent: "linalg",
    tags: ["dot-product"],
    recent: true,
  },
  { id: "ln-orth", title: "Orthogonality", parent: "linalg" },
  {
    id: "ln-proj",
    title: "Vector Projections",
    parent: "linalg",
    tags: ["projection"],
    recent: true,
  },
  { id: "ln-basis", title: "Basis & Span", parent: "linalg" },
  { id: "ln-eigen", title: "Eigenvalues", parent: "linalg" },

  // Calculus cluster
  { id: "ca-limits", title: "Limits", parent: "calc", tags: ["epsilon-delta"] },
  { id: "ca-deriv", title: "Derivatives", parent: "calc", recent: true },
  { id: "ca-chain", title: "Chain Rule", parent: "calc" },
  { id: "ca-int", title: "Integration", parent: "calc", tags: ["u-sub"] },
  { id: "ca-series", title: "Series Convergence", parent: "calc" },
  { id: "ca-taylor", title: "Taylor Series", parent: "calc" },

  // Probability cluster
  { id: "pr-cond", title: "Conditional Prob.", parent: "prob" },
  { id: "pr-bayes", title: "Bayes' Theorem", parent: "prob", recent: true },
  { id: "pr-rv", title: "Random Variables", parent: "prob" },
  { id: "pr-clt", title: "Central Limit", parent: "prob" },
];

const edges: Edge[] = [
  // similarity inside Linear Algebra
  { source: "ln-vectors", target: "ln-dot", kind: "similarity", strength: 0.82 },
  { source: "ln-dot", target: "ln-orth", kind: "similarity", strength: 0.71 },
  { source: "ln-orth", target: "ln-proj", kind: "similarity", strength: 0.78 },
  { source: "ln-dot", target: "ln-proj", kind: "similarity", strength: 0.86 },
  { source: "ln-vectors", target: "ln-basis", kind: "similarity", strength: 0.55 },
  { source: "ln-basis", target: "ln-eigen", kind: "similarity", strength: 0.5 },

  // similarity inside Calculus
  { source: "ca-limits", target: "ca-deriv", kind: "similarity", strength: 0.76 },
  { source: "ca-deriv", target: "ca-chain", kind: "similarity", strength: 0.74 },
  { source: "ca-deriv", target: "ca-int", kind: "similarity", strength: 0.43 },
  { source: "ca-int", target: "ca-series", kind: "similarity", strength: 0.41 },
  { source: "ca-series", target: "ca-taylor", kind: "similarity", strength: 0.83 },

  // similarity inside Probability
  { source: "pr-cond", target: "pr-bayes", kind: "similarity", strength: 0.88 },
  { source: "pr-rv", target: "pr-clt", kind: "similarity", strength: 0.62 },
  { source: "pr-cond", target: "pr-rv", kind: "similarity", strength: 0.51 },

  // cross-cluster similarity
  { source: "ln-eigen", target: "pr-clt", kind: "similarity", strength: 0.36 },

  // prereq dependencies (directional)
  { source: "ln-vectors", target: "ln-dot", kind: "prereq", strength: 0.6 },
  { source: "ln-dot", target: "ln-proj", kind: "prereq", strength: 0.7 },
  { source: "ca-limits", target: "ca-deriv", kind: "prereq", strength: 0.7 },
  { source: "ca-deriv", target: "ca-int", kind: "prereq", strength: 0.55 },
  { source: "ca-series", target: "ca-taylor", kind: "prereq", strength: 0.65 },
  { source: "pr-cond", target: "pr-bayes", kind: "prereq", strength: 0.7 },

  // confusion (dashed) — concepts students conflate
  { source: "ln-orth", target: "ln-proj", kind: "confusion", strength: 0.5 },
  { source: "ca-int", target: "ca-series", kind: "confusion", strength: 0.45 },
];

const edgeColor: Record<EdgeKind, string> = {
  similarity: "#2563eb",
  prereq: "#f97316",
  confusion: "#dc2626",
};

const simStroke = (v: number) => {
  if (v >= 0.65) return "#2563eb";
  if (v >= 0.4) return "#60a5fa";
  return "#cbd5e1";
};

export default function NexusVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Seed with a sensible desktop default so the graph renders fully on
  // first paint instead of flashing empty while ResizeObserver fires.
  const [dimensions, setDimensions] = useState({ width: 720, height: 420 });
  const [zoom, setZoom] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const [showSimilarity, setShowSimilarity] = useState(true);
  const [showPrereqs, setShowPrereqs] = useState(true);
  const [showConfusion, setShowConfusion] = useState(true);

  // Positions are derived synchronously from current dimensions. Recomputing
  // via useMemo (rather than mutating a ref in useEffect) means the very
  // first render already has every node placed — no popcorn fade-in.
  const positions = useMemo<Record<string, { x: number; y: number }>>(() => {
    const out: Record<string, { x: number; y: number }> = {};
    if (dimensions.width === 0 || dimensions.height === 0) return out;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const minSide = Math.min(dimensions.width, dimensions.height);
    const aspect = dimensions.height / Math.max(1, dimensions.width);
    const yScale = Math.min(1, Math.max(0.6, aspect * 1.4));
    const clusterR = Math.max(110, Math.min(180, minSide * 0.32));
    const noteR = Math.max(58, Math.min(92, minSide * 0.18));
    const groups: Array<{ key: keyof typeof clusterMeta; angle: number }> = [
      { key: "linalg", angle: -Math.PI / 2 },
      { key: "calc", angle: (Math.PI * 2) / 3 - Math.PI / 2 },
      { key: "prob", angle: (Math.PI * 4) / 3 - Math.PI / 2 },
    ];
    for (const { key, angle } of groups) {
      const gx = cx + Math.cos(angle) * clusterR;
      const gy = cy + Math.sin(angle) * clusterR * yScale;
      const members = notes.filter((n) => n.parent === key);
      members.forEach((n, i) => {
        const a = angle + (i / members.length) * Math.PI * 2;
        out[n.id] = {
          x: gx + Math.cos(a) * noteR,
          y: gy + Math.sin(a) * noteR * yScale,
        };
      });
    }
    return out;
  }, [dimensions]);

  // Pan/drag — same UX as the dashboard.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const viewOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      const h = containerRef.current.offsetHeight;
      setDimensions((d) =>
        d.width === w && d.height === h ? d : { width: w, height: h },
      );
    };
    update();
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(update, 80);
    };
    const ro = new ResizeObserver(debounced);
    ro.observe(containerRef.current);
    window.addEventListener("resize", debounced);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", debounced);
    };
  }, []);


  const beginDrag = (cx: number, cy: number) => {
    setDragging(true);
    dragStartRef.current = { x: cx, y: cy };
    viewOffsetRef.current = { ...viewOffset };
  };
  const moveDrag = (cx: number, cy: number) => {
    if (!dragging) return;
    setDragOffset({
      x: cx - dragStartRef.current.x,
      y: cy - dragStartRef.current.y,
    });
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    setViewOffset({
      x: viewOffsetRef.current.x + dragOffset.x,
      y: viewOffsetRef.current.y + dragOffset.y,
    });
    setDragOffset({ x: 0, y: 0 });
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    beginDrag(e.clientX, e.clientY);
  };
  const onMouseMove = (e: ReactMouseEvent) => moveDrag(e.clientX, e.clientY);
  const onMouseUp = () => endDrag();
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    beginDrag(t.clientX, t.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    moveDrag(t.clientX, t.clientY);
  };
  const onTouchEnd = () => endDrag();

  const transform = `scale(${zoom}) translate(${
    viewOffset.x + dragOffset.x
  }px, ${viewOffset.y + dragOffset.y}px)`;

  const isCompact = dimensions.width > 0 && dimensions.width < 540;
  // Positions are derived synchronously, so the graph is ready on first
  // render — no `initialized` gate needed.
  const initialized = true;

  // Highlight semantics
  const focusedId = activeId ?? hoverId;
  const neighborIds = focusedId
    ? new Set(
        edges
          .filter((e) => e.source === focusedId || e.target === focusedId)
          .map((e) => (e.source === focusedId ? e.target : e.source)),
      )
    : null;

  const visibleEdges = edges.filter((e) =>
    e.kind === "similarity"
      ? showSimilarity
      : e.kind === "prereq"
        ? showPrereqs
        : showConfusion,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_40px_80px_-30px_rgba(0,97,255,0.18)] overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
            </div>
            <div className="ml-2 flex items-center gap-2 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-[#22b8cf]" />
              <span className="font-medium text-slate-700">Calculus II</span>
              <span className="text-slate-300">·</span>
              <span className="uppercase tracking-wide text-[10px] text-slate-400">
                nexus
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500">
            <span className="rounded border border-slate-200 px-1.5 py-0.5 bg-white">
              All Spaces
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Graph */}
          <div className="p-3 sm:p-4">
            <div
              ref={containerRef}
              className="relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden h-[clamp(320px,52vh,500px)] touch-none"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              onClick={() => setActiveId(null)}
              style={{ cursor: dragging ? "grabbing" : "grab" }}
              role="application"
              aria-label="Knowledge graph preview"
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] opacity-60" />

              {initialized && (
                <>
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transform }}
                  >
                    <defs>
                      <marker
                        id="lp-arrow"
                        viewBox="0 -5 10 10"
                        refX="14"
                        refY="0"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto"
                      >
                        <path d="M0,-5L10,0L0,5" fill="#f97316" />
                      </marker>
                    </defs>
                    {visibleEdges.map((e, i) => {
                      const sp = positions[e.source];
                      const tp = positions[e.target];
                      if (!sp || !tp) return null;
                      const isFocused =
                        focusedId === e.source ||
                        focusedId === e.target ||
                        !focusedId;
                      const stroke =
                        e.kind === "similarity"
                          ? simStroke(e.strength)
                          : edgeColor[e.kind];
                      const opacity = focusedId
                        ? isFocused
                          ? 0.85
                          : 0.12
                        : Math.min(0.8, 0.35 + e.strength * 0.5);
                      const width = Math.max(
                        0.8,
                        Math.sqrt(e.strength * 4),
                      );
                      return (
                        <line
                          key={i}
                          x1={sp.x}
                          y1={sp.y}
                          x2={tp.x}
                          y2={tp.y}
                          stroke={stroke}
                          strokeWidth={width}
                          strokeOpacity={opacity}
                          strokeDasharray={
                            e.kind === "confusion" ? "4 3" : ""
                          }
                          markerEnd={
                            e.kind === "prereq" ? "url(#lp-arrow)" : undefined
                          }
                        />
                      );
                    })}
                  </svg>

                  <div className="absolute inset-0" style={{ transform }}>
                    {notes.map((n) => {
                      const pos = positions[n.id];
                      if (!pos) return null;
                      const isActive = activeId === n.id;
                      const isHover = hoverId === n.id;
                      const dim =
                        focusedId &&
                        focusedId !== n.id &&
                        !(neighborIds && neighborIds.has(n.id));
                      const color = clusterMeta[n.parent].color;
                      const r = isCompact ? 5 : 6;
                      return (
                        <div
                          key={n.id}
                          className="absolute"
                          style={{
                            left: pos.x,
                            top: pos.y,
                            transform: "translate(-50%, -50%)",
                            zIndex: isActive ? 30 : isHover ? 20 : 10,
                            opacity: dim ? 0.25 : 1,
                            transition: "opacity 160ms ease",
                          }}
                          onMouseEnter={() => setHoverId(n.id)}
                          onMouseLeave={() => setHoverId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveId(isActive ? null : n.id);
                          }}
                        >
                          <span
                            className="block rounded-full border-2 cursor-pointer"
                            style={{
                              width: r * 2,
                              height: r * 2,
                              backgroundColor: color,
                              borderColor: "white",
                              boxShadow:
                                isActive || isHover
                                  ? `0 0 0 2px white, 0 0 0 4px ${color}55`
                                  : "0 1px 2px rgba(15,23,42,0.18)",
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Labels — only for the focused note + its neighbors,
                      and the cluster centroid notes when nothing focused */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ transform }}
                  >
                    {notes.map((n) => {
                      const pos = positions[n.id];
                      if (!pos) return null;
                      const isActive = activeId === n.id;
                      const isHover = hoverId === n.id;
                      const isNeighbor =
                        !!neighborIds && neighborIds.has(n.id);
                      const showAlways = !focusedId && (isCompact ? false : true);
                      const show =
                        isActive || isHover || isNeighbor || showAlways;
                      if (!show) return null;
                      return (
                        <div
                          key={`label-${n.id}`}
                          className="absolute text-center"
                          style={{
                            left: pos.x,
                            top: pos.y + 8,
                            transform: "translate(-50%, 0)",
                          }}
                        >
                          <span
                            className={`inline-block text-[10px] sm:text-[10.5px] font-medium px-1.5 py-px rounded ${
                              isActive || isHover
                                ? "bg-white/95 text-slate-900 shadow-sm"
                                : "text-slate-700"
                            }`}
                          >
                            {n.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cluster legend */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm p-2 rounded-md border border-slate-200 text-[10px] sm:text-xs">
                    <div className="grid gap-y-1">
                      {(
                        Object.entries(clusterMeta) as Array<
                          [keyof typeof clusterMeta, { label: string; color: string }]
                        >
                      ).map(([key, meta]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-slate-600 truncate">
                            {meta.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Zoom controls */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoom((z) => Math.min(1.6, z + 0.1));
                      }}
                      className="w-6 h-6 bg-white rounded-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoom((z) => Math.max(0.5, z - 0.1));
                      }}
                      className="w-6 h-6 bg-white rounded-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Minus size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sidebar — same shape as the dashboard's Nexus side panel */}
          <aside className="p-3 sm:p-4 space-y-4 bg-white">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0061ff]" />
                Relations
              </div>
              <p className="text-[10.5px] text-slate-500 leading-relaxed">
                Color = parent topic. Toggle layers to surface dependencies
                and confusion between notes.
              </p>
            </div>

            <div className="space-y-1">
              {(
                [
                  {
                    label: "Similarity",
                    color: "#2563eb",
                    on: showSimilarity,
                    set: setShowSimilarity,
                    count: edges.filter((e) => e.kind === "similarity").length,
                  },
                  {
                    label: "Dependencies",
                    color: "#f97316",
                    on: showPrereqs,
                    set: setShowPrereqs,
                    count: edges.filter((e) => e.kind === "prereq").length,
                    arrow: true,
                  },
                  {
                    label: "Confusion",
                    color: "#dc2626",
                    on: showConfusion,
                    set: setShowConfusion,
                    count: edges.filter((e) => e.kind === "confusion").length,
                    dashed: true,
                  },
                ] as const
              ).map((row) => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => row.set(!row.on)}
                  className={`flex items-center gap-2 w-full px-1.5 py-1 rounded text-[10.5px] hover:bg-slate-50 ${
                    row.on ? "text-slate-700" : "text-slate-400"
                  }`}
                  aria-pressed={row.on}
                >
                  <svg width="22" height="6">
                    <line
                      x1="0"
                      y1="3"
                      x2={"arrow" in row && row.arrow ? "16" : "22"}
                      y2="3"
                      stroke={row.on ? row.color : "#cbd5e1"}
                      strokeWidth={1.6}
                      strokeDasharray={
                        "dashed" in row && row.dashed ? "3 2" : ""
                      }
                    />
                    {"arrow" in row && row.arrow && (
                      <polygon
                        points="16,0 22,3 16,6"
                        fill={row.on ? row.color : "#cbd5e1"}
                      />
                    )}
                  </svg>
                  <span className="flex-1 truncate text-left">{row.label}</span>
                  <span className="text-[9px] tabular-nums text-slate-400">
                    {row.count}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                Clusters
              </div>
              <ul className="space-y-1">
                {(Object.keys(clusterMeta) as Array<keyof typeof clusterMeta>).map(
                  (k) => {
                    const meta = clusterMeta[k];
                    const count = notes.filter((n) => n.parent === k).length;
                    return (
                      <li
                        key={k}
                        className="flex items-center justify-between rounded px-1.5 py-1 text-[10.5px] text-slate-700"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="truncate font-medium">
                            {meta.label}
                          </span>
                        </span>
                        <span className="text-[9px] text-slate-400 tabular-nums">
                          {count}
                        </span>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                Tags
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(
                  new Set(notes.flatMap((n) => n.tags ?? [])),
                ).map((t) => (
                  <span
                    key={t}
                    className="text-[9.5px] rounded-full px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-600"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">
                Recent
              </div>
              <ul className="space-y-0.5">
                {notes
                  .filter((n) => n.recent)
                  .map((n) => (
                    <li
                      key={n.id}
                      className="flex items-center gap-1.5 px-1.5 py-0.5 text-[10.5px] text-slate-700"
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: clusterMeta[n.parent].color,
                        }}
                      />
                      <span className="truncate">{n.title}</span>
                    </li>
                  ))}
              </ul>
            </div>
          </aside>
        </div>

        <div className="h-[2px] w-full bg-gradient-to-r from-[#0061ff] via-[#60efff] to-[#0061ff] bg-[length:200%_100%] animate-gradient-x" />
      </motion.div>
      <p className="text-center text-[12px] text-slate-500 mt-5 max-w-xl mx-auto">
        The actual Nexus tab — every node is a note, colored by its topic
        cluster, with similarity, dependency, and confusion edges layered on
        top.
      </p>
    </div>
  );
}
