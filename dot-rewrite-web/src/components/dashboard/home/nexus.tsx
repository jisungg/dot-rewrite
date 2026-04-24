"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
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

interface LinkDatum extends d3.SimulationLinkDatum<NoteNode> {
  value: number;
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
  const [isSpaceDropdownOpen, setIsSpaceDropdownOpen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const simulationRef = useRef<d3.Simulation<NoteNode, LinkDatum> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          note.title.toLowerCase().includes(term) ||
          note.content.toLowerCase().includes(term) ||
          note.tags.some((tag) => tag.toLowerCase().includes(term))
        );
      }
      return true;
    });
  }, [allNotes, activeSpace, searchTerm, activeTag]);

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
  }, [allNotes, allSpaces]);

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

    const nodes: NoteNode[] = filteredNotes.map((note) => ({
      ...note,
      x: undefined,
      y: undefined,
      vx: undefined,
      vy: undefined,
      fx: undefined,
      fy: undefined,
      index: undefined,
    }));

    const links: LinkDatum[] = [];
    const notesBySpace: Record<string, Note[]> = {};

    filteredNotes.forEach((note) => {
      if (!notesBySpace[note.space_id]) notesBySpace[note.space_id] = [];
      notesBySpace[note.space_id].push(note);
    });

    Object.values(notesBySpace).forEach((spaceNotes) => {
      if (spaceNotes.length > 1) {
        for (let i = 0; i < spaceNotes.length; i++) {
          const nextIndex = (i + 1) % spaceNotes.length;
          links.push({
            source: spaceNotes[i].id,
            target: spaceNotes[nextIndex].id,
            value: 1,
          });

          if (spaceNotes.length > 3) {
            const randomIndex = Math.floor(Math.random() * spaceNotes.length);
            if (randomIndex !== i && randomIndex !== nextIndex) {
              links.push({
                source: spaceNotes[i].id,
                target: spaceNotes[randomIndex].id,
                value: 0.7,
              });
            }
          }
        }
      }
    });

    // Shared-tag relations (placeholder AI-style cross-links)
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
          links.push({ source: a, target: b, value: 0.5 });
        }
      }
    });

    if (activeSpace === "all" && Object.keys(notesBySpace).length > 1) {
      const spaceIds = Object.keys(notesBySpace);
      for (let i = 0; i < spaceIds.length; i++) {
        const currentSpaceNotes = notesBySpace[spaceIds[i]];
        if (currentSpaceNotes && currentSpaceNotes.length > 0) {
          const nextSpaceIndex = (i + 1) % spaceIds.length;
          const nextSpaceNotes = notesBySpace[spaceIds[nextSpaceIndex]];

          if (nextSpaceNotes && nextSpaceNotes.length > 0) {
            const sourceNote =
              currentSpaceNotes[
                Math.floor(Math.random() * currentSpaceNotes.length)
              ];
            const targetNote =
              nextSpaceNotes[
                Math.floor(Math.random() * nextSpaceNotes.length)
              ];
            links.push({
              source: sourceNote.id,
              target: targetNote.id,
              value: 0.4,
            });
          }
        }
      }
    }

    const simulation = d3
      .forceSimulation<NoteNode, LinkDatum>(nodes)
      .force(
        "link",
        d3
          .forceLink<NoteNode, LinkDatum>(links)
          .id((d) => d.id)
          .distance((d) => 90 / (d.value || 1)),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(15));

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

    const link = g
      .append("g")
      .selectAll<SVGLineElement, LinkDatum>(".link")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("stroke", "#B8B8B7")
      .attr("stroke-opacity", (d) => d.value * 0.95)
      .attr("stroke-width", (d) => Math.sqrt(d.value * 2.5 || 1));

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

    node
      .append("circle")
      .attr("r", 5)
      .attr("fill", (d: NoteNode) => {
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

    return () => {
      if (simulationRef.current) simulationRef.current.stop();
      measureSvg.remove();
    };
  }, [dimensions, filteredNotes, allSpaces, activeSpace]);

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
                  <span className="truncate max-w-[160px]">
                    {space.name.length > 25
                      ? space.name.slice(0, 22) + "..."
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
          <aside className="w-64 flex-shrink-0 border border-gray-100/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-y-auto glow-border-lg">
            <div className="p-3 border-b border-gray-100/80 dark:border-zinc-800 flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-100">
                  Relations
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  AI clustering coming soon. Showing shared-tag + space
                  groupings.
                </div>
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
