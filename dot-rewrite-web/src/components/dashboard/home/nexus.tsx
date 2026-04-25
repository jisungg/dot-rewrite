"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import {
  fetchSimEdges,
  fetchTopicClusters,
  fetchSemanticEdges,
  fetchSemanticClusters,
  fetchPrereqEdgesForSpaces,
  fetchConfusionPairsForSpaces,
} from "@/utils/supabase/queries";
import type {
  SimEdge,
  TopicClusterRow,
  SemanticEdgeRow,
  SemanticClusterRow,
  StudyStateEdgeRow,
  ConfusionPairRow,
} from "@/data/types";
import { useEngineUpdates } from "@/lib/engine-events";
import {
  Plus,
  Minus,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Hash,
  Clock,
  PanelRightClose,
  PanelRightOpen,
  Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Space, Note } from "@/data/types";

interface NoteNode extends d3.SimulationNodeDatum {
  id: string;
  space_id: string;
  title: string;
  content: string;
  tags: string[];
}

type LinkKind = "semantic" | "fused" | "tag" | "prereq" | "confusion";

interface LinkDatum extends d3.SimulationLinkDatum<NoteNode> {
  value: number;
  kind: LinkKind;
}

export default function Nexus({
  allSpaces,
  allNotes,
}: {
  allSpaces: Space[];
  allNotes: Note[];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeSpace, setActiveSpace] = useState<string | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  // Debounced copy of searchTerm used by the graph rebuild effect so the
  // simulation doesn't tear down on every keystroke (fixes the multi-second
  // lag while typing).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 180);
    return () => clearTimeout(id);
  }, [searchTerm]);
  const [isSpaceDropdownOpen, setIsSpaceDropdownOpen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // Cached node positions so re-renders warm-start instead of flinging nodes
  // back to the center every time.
  const positionCacheRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const simulationRef = useRef<d3.Simulation<NoteNode, LinkDatum> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const [topics, setTopics] = useState<TopicClusterRow[]>([]);
  const [semanticEdges, setSemanticEdges] = useState<SemanticEdgeRow[]>([]);
  const [semanticClusters, setSemanticClusters] = useState<
    SemanticClusterRow[]
  >([]);
  const [prereqEdges, setPrereqEdges] = useState<StudyStateEdgeRow[]>([]);
  const [confusionPairs, setConfusionPairs] = useState<ConfusionPairRow[]>([]);
  const [showSemantic, setShowSemantic] = useState(true);
  const [showPrereqs, setShowPrereqs] = useState(true);
  const [showConfusion, setShowConfusion] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  // Engine-completion hook: any analyze run finishes anywhere in the
  // user's account → re-pull the engine-owned tables so Nexus reflects
  // new clusters / edges / diagnostics without a hard refresh.
  useEngineUpdates(() => setReloadTick((t) => t + 1));

  useEffect(() => {
    let cancelled = false;
    const spaceIds = allSpaces.map((s) => s.id);
    if (spaceIds.length === 0) {
      setSimEdges([]);
      setTopics([]);
      setSemanticEdges([]);
      setSemanticClusters([]);
      return;
    }
    (async () => {
      try {
        const [edges, tps, sEdges, sClusters, pEdges, cPairs] = await Promise.all([
          fetchSimEdges(spaceIds),
          fetchTopicClusters(spaceIds),
          fetchSemanticEdges(spaceIds),
          fetchSemanticClusters(spaceIds),
          fetchPrereqEdgesForSpaces(spaceIds),
          fetchConfusionPairsForSpaces(spaceIds),
        ]);
        if (!cancelled) {
          setSimEdges(edges);
          setTopics(tps);
          setSemanticEdges(sEdges);
          setSemanticClusters(sClusters);
          setPrereqEdges(pEdges);
          setConfusionPairs(cPairs);
        }
      } catch (err) {
        console.error("nexus engine fetch:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allSpaces, reloadTick]);

  // Prefer semantic clusters for coloring; group by the top-level parent
  // topic (e.g. "Mathematics") so a whole subject shares a color — falls
  // back to the cluster's stable id if no parent/hierarchy is set.
  const clusterByNoteId = useMemo(() => {
    const m = new Map<
      string,
      {
        id: string;
        stable_id: string | null;
        label: string | null;
        group_key: string;
        parent: string | null;
      }
    >();
    for (const c of semanticClusters) {
      const parent =
        c.hierarchy_path && c.hierarchy_path.length > 0
          ? c.hierarchy_path[0]
          : c.parent_topic;
      const key = parent ?? c.stable_id ?? c.id;
      for (const nid of c.note_ids)
        m.set(nid, {
          id: c.id,
          stable_id: c.stable_id,
          label: c.label,
          group_key: key,
          parent: parent ?? null,
        });
    }
    if (m.size > 0) return m;
    for (const t of topics) {
      for (const nid of t.note_ids)
        m.set(nid, {
          id: t.id,
          stable_id: t.stable_id,
          label: t.label,
          group_key: t.stable_id ?? t.id,
          parent: null,
        });
    }
    return m;
  }, [semanticClusters, topics]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      setDimensions({ width: el.offsetWidth, height: el.offsetHeight });
    };
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(update, 160);
    };
    update();
    const ro = new ResizeObserver(debounced);
    ro.observe(el);
    window.addEventListener("resize", debounced);
    return () => {
      if (timer) clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", debounced);
    };
  }, []);

  const filteredNotes = useMemo(() => {
    return allNotes.filter((note) => {
      if (activeSpace !== "all" && note.space_id !== activeSpace) return false;
      if (activeTag && !note.tags.includes(activeTag)) return false;

      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();
        return (
          note.title.toLowerCase().includes(term) ||
          note.content.toLowerCase().includes(term) ||
          note.tags.some((tag) => tag.toLowerCase().includes(term))
        );
      }
      return true;
    });
  }, [allNotes, activeSpace, debouncedSearch, activeTag]);

  const tagStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of allNotes) {
      for (const t of n.tags) counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [allNotes]);

  const generatedClusters = useMemo(() => {
    if (semanticClusters.length > 0) {
      return semanticClusters
        .slice()
        .sort((a, b) => b.note_ids.length - a.note_ids.length)
        .slice(0, 8)
        .map((c) => ({
          id: `semantic:${c.id}`,
          label:
            c.label ||
            (c.keywords[0]
              ? c.keywords[0].charAt(0).toUpperCase() + c.keywords[0].slice(1)
              : "Cluster"),
          hint:
            c.hierarchy_path && c.hierarchy_path.length > 1
              ? c.hierarchy_path.slice(0, -1).join(" / ")
              : (c.parent_topic ?? "topic"),
          size: c.note_ids.length,
        }));
    }
    if (topics.length > 0) {
      return topics
        .slice()
        .sort((a, b) => b.note_ids.length - a.note_ids.length)
        .slice(0, 8)
        .map((t) => ({
          id: `topic:${t.id}`,
          label:
            t.label ||
            (t.keywords[0]
              ? t.keywords[0].charAt(0).toUpperCase() + t.keywords[0].slice(1)
              : "Topic"),
          hint: "algorithmic topic",
          size: t.note_ids.length,
        }));
    }
    const byTag: Record<string, Note[]> = {};
    for (const n of allNotes) {
      for (const t of n.tags) {
        if (!byTag[t]) byTag[t] = [];
        byTag[t].push(n);
      }
    }
    const clusters = Object.entries(byTag)
      .filter(([, notes]) => notes.length >= 2)
      .map(([tag, notes]) => ({
        id: `tag:${tag}`,
        label: tag.charAt(0).toUpperCase() + tag.slice(1),
        hint: "shared tag",
        size: notes.length,
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 6);
    if (clusters.length < 3 && allSpaces.length > 0) {
      for (const s of allSpaces) {
        const count = allNotes.filter((n) => n.space_id === s.id).length;
        if (count >= 2) {
          clusters.push({
            id: `space:${s.id}`,
            label: s.name,
            hint: "space",
            size: count,
          });
        }
      }
    }
    return clusters.slice(0, 8);
  }, [semanticClusters, topics, allNotes, allSpaces]);

  const recentNotes = useMemo(() => {
    return [...allNotes]
      .sort(
        (a, b) =>
          new Date(b.last_modified_at ?? b.created_at ?? 0).getTime() -
          new Date(a.last_modified_at ?? a.created_at ?? 0).getTime(),
      )
      .slice(0, 8);
  }, [allNotes]);

  useEffect(() => {
    if (!svgRef.current || !filteredNotes.length) return;

    d3.select(svgRef.current).selectAll("*").remove();

    const width = dimensions.width;
    const height = dimensions.height;
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 4, height / 4).scale(0.8),
    );

    const nodes: NoteNode[] = filteredNotes.map((note) => {
      const prior = positionCacheRef.current.get(note.id);
      return {
        ...note,
        x: prior?.x,
        y: prior?.y,
        vx: undefined,
        vy: undefined,
        fx: undefined,
        fy: undefined,
        index: undefined,
      };
    });

    const links: LinkDatum[] = [];
    const notesBySpace: Record<string, Note[]> = {};

    filteredNotes.forEach((note) => {
      if (!notesBySpace[note.space_id]) notesBySpace[note.space_id] = [];
      notesBySpace[note.space_id].push(note);
    });

    const visibleIds = new Set(filteredNotes.map((n) => n.id));
    const visibleSemantic = semanticEdges.filter(
      (e) => visibleIds.has(e.src_note_id) && visibleIds.has(e.dst_note_id),
    );
    const visibleFused = simEdges.filter(
      (e) => visibleIds.has(e.src_note_id) && visibleIds.has(e.dst_note_id),
    );

    if (showSemantic && visibleSemantic.length > 0) {
      // PRIMARY: semantic (embedding cosine) edges.
      for (const e of visibleSemantic) {
        links.push({
          source: e.src_note_id,
          target: e.dst_note_id,
          value: Math.max(0.1, e.similarity),
          kind: "semantic",
        });
      }
    } else if (showSemantic && visibleFused.length > 0) {
      // Secondary: fused algorithmic edges.
      for (const e of visibleFused) {
        links.push({
          source: e.src_note_id,
          target: e.dst_note_id,
          value: Math.max(0.08, e.weight),
          kind: "fused",
        });
      }
    } else if (!showSemantic) {
      // Similarity layer hidden — fall through to relationship layers
      // alone (prereqs / confusion / tag fallback added below).
    } else {
      // Fallback: placeholder structural links when engine has not run yet.
      Object.values(notesBySpace).forEach((spaceNotes) => {
        if (spaceNotes.length > 1) {
          for (let i = 0; i < spaceNotes.length; i++) {
            const nextIndex = (i + 1) % spaceNotes.length;
            links.push({
              source: spaceNotes[i].id,
              target: spaceNotes[nextIndex].id,
              value: 1,
              kind: "tag",
            });
          }
        }
      });

      const notesByTag: Record<string, Note[]> = {};
      filteredNotes.forEach((note) => {
        for (const t of note.tags) {
          if (!notesByTag[t]) notesByTag[t] = [];
          notesByTag[t].push(note);
        }
      });
      const seenPair = new Set<string>();
      Object.values(notesByTag).forEach((group) => {
        if (group.length < 2) return;
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i].id;
            const b = group[j].id;
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            if (seenPair.has(key)) continue;
            seenPair.add(key);
            links.push({ source: a, target: b, value: 0.5, kind: "tag" });
          }
        }
      });
    }

    // Layered relationships from the engine — overlaid on top of similarity.
    if (showPrereqs) {
      for (const e of prereqEdges) {
        if (!visibleIds.has(e.src_node_id) || !visibleIds.has(e.dst_node_id))
          continue;
        links.push({
          source: e.src_node_id,
          target: e.dst_node_id,
          value: Math.max(0.18, e.weight ?? 0.4),
          kind: "prereq",
        });
      }
    }
    if (showConfusion && confusionPairs.length > 0 && semanticClusters.length > 0) {
      // Confusion is topic-level — surface it as dashed connections
      // between the central note of each topic in a confusion pair.
      const topicById = new Map<string, SemanticClusterRow>();
      for (const c of semanticClusters) topicById.set(c.id, c);
      for (const cp of confusionPairs) {
        const a = topicById.get(cp.topic_a);
        const b = topicById.get(cp.topic_b);
        if (!a || !b) continue;
        const aRep = a.note_ids.find((id) => visibleIds.has(id));
        const bRep = b.note_ids.find((id) => visibleIds.has(id));
        if (!aRep || !bRep || aRep === bRep) continue;
        links.push({
          source: aRep,
          target: bRep,
          value: Math.max(0.18, Math.min(1, cp.score ?? 0.4)),
          kind: "confusion",
        });
      }
    }

    // Faster-settling simulation — alphaDecay ~2× default so the graph
    // stabilises in ~1-2s instead of 4-5s.
    const simulation = d3
      .forceSimulation<NoteNode, LinkDatum>(nodes)
      .alphaDecay(0.05)
      .velocityDecay(0.3)
      .force(
        "link",
        d3
          .forceLink<NoteNode, LinkDatum>(links)
          .id((d) => d.id)
          .distance((d) => 90 / (d.value || 1))
          .strength((d) => Math.min(1, d.value * 1.2)),
      )
      .force("charge", d3.forceManyBody().strength(-260).distanceMax(320))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(14));

    if (activeSpace === "all") {
      simulation.force(
        "x",
        d3
          .forceX<NoteNode>()
          .x((d) => {
            const spaceIndex = allSpaces.findIndex(
              (space) => space.id === d.space_id,
            );
            const angle = (spaceIndex / allSpaces.length) * 2 * Math.PI;
            const radius = Math.min(width, height) / 4;
            return width / 2 + radius * Math.cos(angle);
          })
          .strength(0.2),
      );

      simulation.force(
        "y",
        d3
          .forceY<NoteNode>()
          .y((d) => {
            const spaceIndex = allSpaces.findIndex(
              (space) => space.id === d.space_id,
            );
            const angle = (spaceIndex / allSpaces.length) * 2 * Math.PI;
            const radius = Math.min(width, height) / 4;
            return height / 2 + radius * Math.sin(angle);
          })
          .strength(0.2),
      );
    }

    simulationRef.current = simulation;

    const linkTier = (v: number) => {
      if (v >= 0.65) return "strong";
      if (v >= 0.4) return "medium";
      return "weak";
    };
    const simStroke = (v: number) => {
      const t = linkTier(v);
      if (t === "strong") return "#2563eb"; // blue-600
      if (t === "medium") return "#60a5fa"; // blue-400
      return "#cbd5e1"; // slate-300
    };
    const strokeFor = (d: LinkDatum) => {
      if (d.kind === "prereq") return "#f97316"; // orange-500 — directional dependency
      if (d.kind === "confusion") return "#dc2626"; // red-600 — confusable topics
      if (d.kind === "tag") return "#a3a3a3";
      return simStroke(d.value);
    };
    const dashFor = (d: LinkDatum) =>
      d.kind === "confusion" ? "4 3" : null;

    // Arrowhead marker for prereq edges (directional).
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow-prereq")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 14)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#f97316");

    const link = g
      .append("g")
      .selectAll<SVGLineElement, LinkDatum>(".link")
      .data(links)
      .join("line")
      .attr("class", (d) => `link link-${d.kind}`)
      .attr("stroke", (d) => strokeFor(d))
      .attr("stroke-opacity", (d) =>
        Math.min(
          0.95,
          (d.kind === "prereq" || d.kind === "confusion" ? 0.6 : 0.35) +
            d.value * 0.5,
        ),
      )
      .attr("stroke-width", (d) => Math.max(0.8, Math.sqrt(d.value * 4)))
      .attr("stroke-dasharray", (d) => dashFor(d) ?? "")
      .attr(
        "marker-end",
        (d) => (d.kind === "prereq" ? "url(#arrow-prereq)" : null),
      )
      .style("cursor", "pointer");

    link
      .append("title")
      .text((d) => {
        const src = typeof d.source === "object" ? d.source.title : d.source;
        const dst = typeof d.target === "object" ? d.target.title : d.target;
        if (d.kind === "prereq") {
          return `${src} → ${dst}\ndependency (prerequisite)`;
        }
        if (d.kind === "confusion") {
          return `${src} ↔ ${dst}\nconfusable topics — review side by side`;
        }
        const tier = linkTier(d.value);
        return `${src} ↔ ${dst}\nrelation: ${tier} (${(d.value * 100).toFixed(0)}%)`;
      });

    link
      .on("mouseover", function (_, d) {
        d3.select(this)
          .attr("stroke-opacity", Math.min(1, 0.7 + d.value * 0.3))
          .attr("stroke-width", Math.max(1.8, Math.sqrt(d.value * 8)));
      })
      .on("mouseout", function (_, d) {
        d3.select(this)
          .attr("stroke-opacity", Math.min(0.9, 0.35 + d.value * 0.6))
          .attr("stroke-width", Math.max(0.8, Math.sqrt(d.value * 4)));
      });

    const node = g
      .append("g")
      .selectAll<SVGGElement, NoteNode>(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node");

    const drag = d3
      .drag<SVGGElement, NoteNode>()
      .on(
        "start",
        (
          event: d3.D3DragEvent<SVGGElement, NoteNode, NoteNode>,
          d: NoteNode,
        ) => {
          if (!event.active && simulationRef.current)
            simulationRef.current.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        },
      )
      .on(
        "drag",
        (
          event: d3.D3DragEvent<SVGGElement, NoteNode, NoteNode>,
          d: NoteNode,
        ) => {
          d.fx = event.x;
          d.fy = event.y;
        },
      )
      .on(
        "end",
        (
          event: d3.D3DragEvent<SVGGElement, NoteNode, NoteNode>,
          d: NoteNode,
        ) => {
          if (!event.active && simulationRef.current)
            simulationRef.current.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        },
      );

    node.call(drag);

    const clusterPalette = d3.schemeTableau10;
    const groupIndex = new Map<string, number>();
    let groupCounter = 0;
    const assignGroup = (key: string) => {
      if (!groupIndex.has(key)) groupIndex.set(key, groupCounter++);
    };
    for (const c of semanticClusters) {
      const parent =
        c.hierarchy_path && c.hierarchy_path.length > 0
          ? c.hierarchy_path[0]
          : c.parent_topic;
      assignGroup(parent ?? c.stable_id ?? c.id);
    }
    for (const t of topics) assignGroup(t.stable_id ?? t.id);

    node
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d: NoteNode) => {
        const cluster = clusterByNoteId.get(d.id);
        if (cluster) {
          const idx = groupIndex.get(cluster.group_key) ?? 0;
          return clusterPalette[idx % clusterPalette.length];
        }
        const space = allSpaces.find((s) => s.id === d.space_id);
        return space ? space.color : "#ccc";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 1);

    const measureSvg = d3
      .select("body")
      .append("svg")
      .attr("width", 0)
      .attr("height", 0)
      .style("visibility", "hidden")
      .style("position", "absolute");

    node
      .on("mouseover", function (_, d: NoteNode) {
        d3.select(this).select("circle").transition().duration(150).attr("r", 7);

        const tooltip = g
          .append("g")
          .attr("class", "tooltip")
          .attr("transform", `translate(${d.x! + 10},${d.y! - 30})`);

        const titleText = measureSvg
          .append("text")
          .attr("font-size", "11px")
          .attr("font-weight", "500")
          .text(d.title);

        const titleWidth =
          titleText.node()?.getComputedTextLength() || d.title.length * 6;
        titleText.remove();

        tooltip
          .append("text")
          .attr("x", 8)
          .attr("y", 16)
          .attr("font-size", "11px")
          .attr("font-weight", "500")
          .text(d.title);

        const tagWidths: number[] = [];
        const tagGroups: d3.Selection<
          SVGGElement,
          unknown,
          null,
          undefined
        >[] = [];
        let currentRowWidth = 0;
        let currentRow = 0;
        const maxTooltipWidth = Math.max(titleWidth + 16, 120);
        const tagSpacing = 6;
        const tagPadding = 8;

        if (d.tags.length > 0) {
          d.tags.forEach((tag, i) => {
            const tagText = measureSvg
              .append("text")
              .attr("font-size", "9px")
              .text(`#${tag}`);

            const textWidth =
              tagText.node()?.getComputedTextLength() || tag.length * 6;
            tagText.remove();

            const tagWidth = textWidth + tagPadding;
            tagWidths.push(tagWidth);

            if (
              currentRowWidth + tagWidth + tagSpacing > maxTooltipWidth &&
              currentRowWidth > 0
            ) {
              currentRow++;
              currentRowWidth = tagWidth;
            } else {
              currentRowWidth +=
                tagWidth + (currentRowWidth > 0 ? tagSpacing : 0);
            }

            const tagGroup = tooltip
              .append("g")
              .attr("class", `tag-${i}`)
              .attr("data-row", currentRow);

            tagGroups.push(tagGroup);
          });
        }

        const tooltipWidth = Math.max(maxTooltipWidth, currentRowWidth + 16);
        const tagRowHeight = 18;
        const tagSectionHeight =
          d.tags.length > 0 ? (currentRow + 1) * tagRowHeight + 4 : 0;
        const tooltipHeight = 24 + tagSectionHeight;

        tooltip
          .insert("rect", ":first-child")
          .attr("rx", 4)
          .attr("ry", 4)
          .attr("width", tooltipWidth)
          .attr("height", tooltipHeight)
          .attr("fill", "white")
          .attr("stroke", "#e5e7eb")
          .attr("stroke-width", 1)
          .attr("opacity", 0.6);

        if (d.tags.length > 0) {
          const rowWidths: Record<number, number> = {};
          const rowPositions: Record<number, number> = {};

          tagGroups.forEach((group, i) => {
            const row = Number.parseInt(group.attr("data-row") || "0");
            if (rowWidths[row] === undefined) {
              rowWidths[row] = 0;
              rowPositions[row] = 8;
            }

            const tagWidth = tagWidths[i];
            group.attr(
              "transform",
              `translate(${rowPositions[row]}, ${28 + row * tagRowHeight})`,
            );

            group
              .append("rect")
              .attr("rx", 3)
              .attr("ry", 3)
              .attr("width", tagWidth)
              .attr("height", 14)
              .attr("fill", "#f3f4f6")
              .attr("stroke", "#e5e7eb")
              .attr("stroke-width", 0.5);

            group
              .append("text")
              .attr("x", 4)
              .attr("y", 10)
              .attr("font-size", "9px")
              .attr("fill", "#6b7280")
              .text(`#${d.tags[i]}`);

            rowPositions[row] += tagWidth + tagSpacing;
            rowWidths[row] += tagWidth + tagSpacing;
          });
        }
      })
      .on("mouseout", function () {
        d3.select(this)
          .select("circle")
          .transition()
          .duration(150)
          .attr("r", 5);
        g.selectAll(".tooltip").remove();
      });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as NoteNode).x!)
        .attr("y1", (d) => (d.source as NoteNode).y!)
        .attr("x2", (d) => (d.target as NoteNode).x!)
        .attr("y2", (d) => (d.target as NoteNode).y!);

      node.attr("transform", (d) => `translate(${d.x!},${d.y!})`);
    });

    // Persist final positions so the next rebuild warm-starts from here.
    simulation.on("end", () => {
      for (const n of nodes) {
        if (typeof n.x === "number" && typeof n.y === "number") {
          positionCacheRef.current.set(n.id, { x: n.x, y: n.y });
        }
      }
    });

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
      measureSvg.remove();
    };
  }, [
    dimensions,
    filteredNotes,
    allSpaces,
    activeSpace,
    simEdges,
    semanticEdges,
    semanticClusters,
    topics,
    prereqEdges,
    confusionPairs,
    showSemantic,
    showPrereqs,
    showConfusion,
    clusterByNoteId,
  ]);

  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      const currentTransform = d3.zoomTransform(svgRef.current);
      const newScale = currentTransform.k * 1.2;

      svg
        .transition()
        .duration(300)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity
            .translate(currentTransform.x, currentTransform.y)
            .scale(newScale),
        );
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      const currentTransform = d3.zoomTransform(svgRef.current);
      const newScale = currentTransform.k * 0.8;

      svg
        .transition()
        .duration(300)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity
            .translate(currentTransform.x, currentTransform.y)
            .scale(newScale),
        );
    }
  };

  const getSpaceById = (spaceId: string) => {
    return allSpaces.find((space) => space.id === spaceId) || null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 py-4 px-6">
        <div className="flex items-center gap-4">
          <DropdownMenu
            open={isSpaceDropdownOpen}
            onOpenChange={setIsSpaceDropdownOpen}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 text-sm font-medium h-8 px-3"
              >
                {activeSpace === "all" ? (
                  <>
                    All Spaces
                    {isSpaceDropdownOpen ? (
                      <ChevronUp className="h-4 w-4 opacity-70" />
                    ) : (
                      <ChevronDown className="h-4 w-4 opacity-70" />
                    )}
                  </>
                ) : (
                  <>
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          getSpaceById(activeSpace)?.color || "#6b7280",
                      }}
                    />
                    {getSpaceById(activeSpace)?.name || "Unknown Space"}
                    {isSpaceDropdownOpen ? (
                      <ChevronUp className="h-4 w-4 opacity-70" />
                    ) : (
                      <ChevronDown className="h-4 w-4 opacity-70" />
                    )}
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-1">
              <button
                onClick={() => setActiveSpace("all")}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-150 ${
                  activeSpace === "all"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>All Spaces</span>
              </button>

              {allSpaces.map((space) => (
                <button
                  key={space.id}
                  onClick={() => setActiveSpace(space.id)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-150 ${
                    activeSpace === space.id
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div
                    className="h-2 w-2 rounded-full mr-3 flex-shrink-0"
                    style={{ backgroundColor: space.color }}
                  />
                  <span>{space.name}</span>
                </button>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative flex-grow min-w-lg max-w-2xl">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
            <Input
              type="text"
              placeholder="Search notes or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 h-8 w-full border-gray-200 text-xs focus:ring-0 focus:border-gray-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="h-7 px-2 text-[11px] rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
            >
              <Hash className="h-3 w-3" />
              {activeTag}
              <span className="ml-1 text-[10px] opacity-60">clear</span>
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomOut}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleZoomIn}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidePanelOpen((v) => !v)}
            aria-label="Toggle side panel"
          >
            {sidePanelOpen ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-3 px-6 pb-4 min-h-0">
        <div
          ref={containerRef}
          className="flex-1 border border-gray-100/80 dark:border-zinc-800 rounded-xl overflow-hidden relative bg-white dark:bg-zinc-950 glow-border-lg"
        >
          <svg ref={svgRef} className="w-full h-full" />
          {activeSpace === "all" && allSpaces.length > 0 && (
            <div className="absolute bottom-4 left-4 rounded-md border border-gray-100/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-2.5 py-2 space-y-1 pointer-events-none glow-border">
              {allSpaces.map((space) => (
                <div
                  key={space.id}
                  className="flex items-center gap-2 text-[10px] text-zinc-700 dark:text-zinc-300"
                >
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: space.color }}
                  />
                  <span className="truncate max-w-[220px]">
                    {space.name.length > 34
                      ? space.name.slice(0, 31) + "..."
                      : space.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          {filteredNotes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Nothing to connect yet
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs">
                {allNotes.length === 0
                  ? "Create notes to see them linked here."
                  : "No notes match this filter."}
              </div>
            </div>
          )}
        </div>

        {sidePanelOpen && (
          <aside className="w-80 flex-shrink-0 border border-gray-100/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-y-auto glow-border-lg">
            <div className="p-3 border-b border-gray-100/80 dark:border-zinc-800 flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-100">
                  Relations
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {semanticClusters.length === 0 && topics.length === 0
                    ? "Process notes to surface semantic relationships."
                    : "Color shows topic groupings. Toggle layers below."}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] text-zinc-600 dark:text-zinc-300">
                  <LayerToggle
                    label="Similarity"
                    color="#2563eb"
                    enabled={showSemantic}
                    count={
                      semanticEdges.length > 0
                        ? semanticEdges.length
                        : simEdges.length
                    }
                    onToggle={() => setShowSemantic((v) => !v)}
                  />
                  <LayerToggle
                    label="Dependencies"
                    color="#f97316"
                    arrow
                    enabled={showPrereqs}
                    count={prereqEdges.length}
                    onToggle={() => setShowPrereqs((v) => !v)}
                  />
                  <LayerToggle
                    label="Confusion"
                    color="#dc2626"
                    dashed
                    enabled={showConfusion}
                    count={confusionPairs.length}
                    onToggle={() => setShowConfusion((v) => !v)}
                  />
                </div>
                {showSemantic && (
                  <div className="mt-1.5 flex items-center gap-3 text-[9px] text-zinc-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 rounded-full bg-blue-600" />
                      strong
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 rounded-full bg-blue-400" />
                      medium
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 rounded-full bg-slate-300" />
                      weak
                    </span>
                  </div>
                )}
              </div>
            </div>

            <section className="p-3 border-b border-gray-100/80 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Clusters
                </h3>
              </div>
              {generatedClusters.length === 0 ? (
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  Add tags or create more notes to form clusters.
                </div>
              ) : (
                <ul className="space-y-1">
                  {generatedClusters.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          if (c.id.startsWith("tag:")) {
                            setActiveTag(c.id.slice(4));
                            setActiveSpace("all");
                          } else if (c.id.startsWith("space:")) {
                            setActiveSpace(c.id.slice(6));
                            setActiveTag(null);
                          } else if (c.id.startsWith("semantic:")) {
                            const cl = semanticClusters.find(
                              (x) => x.id === c.id.slice(9),
                            );
                            if (cl?.keywords[0]) setSearchTerm(cl.keywords[0]);
                          } else if (c.id.startsWith("topic:")) {
                            const topic = topics.find(
                              (t) => t.id === c.id.slice(6),
                            );
                            if (topic?.keywords[0]) {
                              setSearchTerm(topic.keywords[0]);
                            }
                          }
                        }}
                        className="w-full text-left flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] text-zinc-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <span className="truncate flex items-center gap-1.5 min-w-0">
                          <span className="truncate font-medium">
                            {c.label}
                          </span>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                            {c.hint}
                          </span>
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex-shrink-0 bg-gray-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                          {c.size}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="p-3 border-b border-gray-100/80 dark:border-zinc-800">
              <div className="flex items-center gap-1.5 mb-2">
                <Hash className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Tags
                </h3>
              </div>
              {tagStats.length === 0 ? (
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  No tags yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {tagStats.map(([tag, count]) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setActiveTag((prev) => (prev === tag ? null : tag))
                      }
                      className={`text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                        activeTag === tag
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-gray-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-gray-100/80 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700"
                      }`}
                    >
                      #{tag}
                      <span className="ml-1 opacity-60">{count}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Recent
                </h3>
              </div>
              {recentNotes.length === 0 ? (
                <div className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">
                  No notes yet.
                </div>
              ) : (
                <ul className="space-y-1">
                  {recentNotes.map((n) => {
                    const s = allSpaces.find((sp) => sp.id === n.space_id);
                    return (
                      <li
                        key={n.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-zinc-700 dark:text-zinc-200"
                      >
                        <div
                          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s?.color ?? "#9ca3af" }}
                        />
                        <span className="truncate flex-1 min-w-0">
                          {n.title || "Untitled Note"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}

function LayerToggle({
  label,
  color,
  enabled,
  count,
  onToggle,
  dashed = false,
  arrow = false,
}: {
  label: string;
  color: string;
  enabled: boolean;
  count: number;
  onToggle: () => void;
  dashed?: boolean;
  arrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-2 px-1.5 py-1 rounded transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50 text-left ${
        enabled
          ? "text-zinc-700 dark:text-zinc-200"
          : "text-zinc-400 dark:text-zinc-500"
      }`}
      title={enabled ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      aria-pressed={enabled}
    >
      <svg width="22" height="6" className="flex-shrink-0">
        <line
          x1="0"
          y1="3"
          x2={arrow ? "16" : "22"}
          y2="3"
          stroke={enabled ? color : "#cbd5e1"}
          strokeWidth="1.6"
          strokeDasharray={dashed ? "3 2" : ""}
        />
        {arrow && (
          <polygon
            points="16,0 22,3 16,6"
            fill={enabled ? color : "#cbd5e1"}
          />
        )}
      </svg>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
        {count}
      </span>
    </button>
  );
}
