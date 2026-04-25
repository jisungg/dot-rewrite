"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Search,
  ChevronDown,
  ChevronUp,
  Hash,
  PanelRightClose,
  PanelRightOpen,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Space, Note } from "@/data/types";
import {
  useNexusSnapshot,
  useTypedRelations,
} from "@/lib/use-nexus-snapshot";
import { useTier } from "@/lib/use-tier";
import { UpgradeModal, type UpgradeReason } from "@/components/upgrade-modal";
import NexusGraph, {
  type NexusGraphHandle,
  type NexusGraphLayer,
} from "@/components/dashboard/home/nexus-graph";
import NexusInsightsPanel from "@/components/dashboard/home/nexus-insights-panel";

type Layers = Record<NexusGraphLayer, boolean>;

const DEFAULT_LAYERS: Layers = {
  similarity: true,
  prereq: true,
  confusion: true,
  typed: false,
  hulls: true,
  godHalos: true,
};

export default function Nexus({
  allSpaces,
  allNotes,
}: {
  allSpaces: Space[];
  allNotes: Note[];
}) {
  const [activeSpace, setActiveSpace] = useState<string | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string> | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [isSpaceDropdownOpen, setIsSpaceDropdownOpen] = useState(false);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const graphRef = useRef<NexusGraphHandle | null>(null);
  const { isPlus } = useTier();
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 180);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const spaceIds = useMemo(() => allSpaces.map((s) => s.id), [allSpaces]);
  const { snapshot, status, error } = useNexusSnapshot(spaceIds);
  // Plus-only: typed-relation edges + LLM relations come from typed_relations.
  const typedRelationsState = useTypedRelations(
    spaceIds,
    isPlus && layers.typed,
  );

  // Plus-gated effective layers — free can toggle the UI but the graph
  // only renders Plus-only layers when isPlus.
  const effectiveLayers = useMemo<Layers>(
    () =>
      isPlus
        ? layers
        : {
            ...layers,
            typed: false,
            godHalos: false,
            hulls: layers.hulls, // hulls themselves are free; community LABELS are Plus
          },
    [isPlus, layers],
  );

  // Plus-gated insight-kind whitelist for the panel.
  const allowedInsightKinds = useMemo(
    () =>
      isPlus
        ? null // null = no filter
        : new Set<string>(["orphan", "emerging"]),
    [isPlus],
  );

  // Debounced clear of highlight after a focus action so the ring fades.
  useEffect(() => {
    if (!highlighted) return;
    const t = setTimeout(() => setHighlighted(null), 4000);
    return () => clearTimeout(t);
  }, [highlighted]);

  const tagStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of allNotes) {
      for (const t of n.tags) counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [allNotes]);

  const filters = useMemo(
    () => ({
      activeSpaceId: activeSpace,
      search: debouncedSearch,
      activeTag,
      activeCommunityId,
      highlightedNoteIds: highlighted,
      layers: effectiveLayers,
    }),
    [activeSpace, debouncedSearch, activeTag, activeCommunityId, highlighted, effectiveLayers],
  );

  const focusOnNotes = (ids: string[]) => {
    if (ids.length === 0) return;
    setHighlighted(new Set(ids));
    graphRef.current?.focusNotes(ids);
  };

  const getSpaceById = (id: string) => allSpaces.find((s) => s.id === id) ?? null;

  const showGraphSkeleton = status === "loading" && snapshot.notes.length === 0;
  // Three distinct empty states.
  const emptyKind: "none" | "no-notes" | "snapshot-empty" | "no-edges" =
    status !== "ready"
      ? "none"
      : snapshot.notes.length === 0
        ? allNotes.length === 0
          ? "no-notes"
          : "snapshot-empty"
        : snapshot.semantic_edges.length === 0 &&
            snapshot.prereq_edges.length === 0
          ? "no-edges"
          : "none";

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
                    ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60"
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
                      ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                      : "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60"
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
              className="pl-8 pr-3 py-1.5 h-8 w-full border-gray-200 dark:border-zinc-700 text-xs focus:ring-0 focus:border-gray-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(activeTag || activeCommunityId) && (
            <button
              onClick={() => {
                setActiveTag(null);
                setActiveCommunityId(null);
              }}
              className="h-7 px-2 text-[11px] rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1"
            >
              <Hash className="h-3 w-3" />
              {activeTag ?? "community"}
              <span className="ml-1 text-[10px] opacity-60">clear</span>
            </button>
          )}
          {status === "loading" && snapshot.notes.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" /> refreshing
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => graphRef.current?.zoomBy(0.83)}
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => graphRef.current?.zoomBy(1.2)}
            aria-label="Zoom in"
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
        <div className="flex-1 border border-gray-100/80 dark:border-zinc-800 rounded-xl overflow-hidden relative bg-white dark:bg-zinc-950 glow-border-lg">
          {showGraphSkeleton ? (
            <div className="absolute inset-0 p-4 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-[80%] w-full" />
            </div>
          ) : (
            <NexusGraph
              ref={graphRef}
              snapshot={snapshot}
              spaces={allSpaces}
              filters={filters}
              typedRelations={typedRelationsState.data}
              onNodeClick={(n) => focusOnNotes([n.id])}
            />
          )}
          {emptyKind !== "none" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {emptyKind === "no-notes" && "Nothing to connect yet"}
                {emptyKind === "snapshot-empty" && "Snapshot returned no notes"}
                {emptyKind === "no-edges" && "Notes loaded. No connections yet."}
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
                {emptyKind === "no-notes" &&
                  "Create notes to see them linked here."}
                {emptyKind === "snapshot-empty" && (
                  <>
                    The nexus_snapshot RPC returned 0 notes. Apply migration{" "}
                    <code className="font-mono">
                      20260425000000_nexus_intelligence.sql
                    </code>{" "}
                    and confirm RLS lets you read your spaces.
                  </>
                )}
                {emptyKind === "no-edges" &&
                  "Run the engine on each space (`uv run python analyze_space.py --space-id <uuid>`) so semantic edges + clusters get populated."}
              </div>
              {error && (
                <div className="mt-2 text-[11px] text-red-500 dark:text-red-400 max-w-md">
                  {error}
                </div>
              )}
            </div>
          )}
          {/* Layer toggles + legend overlay (bottom-left). */}
          <div className="absolute bottom-3 left-3 rounded-md border border-gray-100/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-2 py-1.5 space-y-0.5">
            {(
              [
                ["similarity", "Similarity", "#2563eb", false],
                ["prereq", "Dependencies", "#f97316", false],
                ["confusion", "Confusion", "#dc2626", false],
                ["typed", "Typed relations", "#9333ea", true],
                ["hulls", "Community hulls", "#94a3b8", false],
                ["godHalos", "Anchor halos", "#facc15", true],
              ] as Array<[NexusGraphLayer, string, string, boolean]>
            ).map(([key, label, color, plusOnly]) => {
              const locked = plusOnly && !isPlus;
              const enabled = effectiveLayers[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (locked) {
                      setUpgradeReason({
                        kind: "feature",
                        feature:
                          key === "typed"
                            ? "Typed relation edges"
                            : "Anchor (god-node) halos",
                      });
                      return;
                    }
                    setLayers((s) => ({ ...s, [key]: !s[key] }));
                  }}
                  aria-pressed={enabled}
                  className={`flex items-center gap-1.5 w-full px-1 py-0.5 rounded text-[10px] transition-colors ${
                    enabled
                      ? "text-zinc-700 dark:text-zinc-200"
                      : "text-zinc-400 dark:text-zinc-500"
                  } ${locked ? "opacity-70" : ""}`}
                  title={locked ? "Plus only" : undefined}
                >
                  <span
                    className="h-1 w-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: enabled ? color : "#cbd5e1" }}
                  />
                  <span className="flex-1 text-left truncate">{label}</span>
                  {locked && (
                    <span className="text-[9px] uppercase tracking-wide text-blue-600 dark:text-blue-400 flex-shrink-0">
                      Plus
                    </span>
                  )}
                  {key === "typed" && typedRelationsState.status === "loading" && (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {sidePanelOpen && (
          <div className="flex flex-col gap-3 w-80 flex-shrink-0">
            <NexusInsightsPanel
              snapshot={snapshot}
              status={status}
              error={error}
              onFocus={focusOnNotes}
              allowedKinds={allowedInsightKinds}
              onLockedClick={(kind) =>
                setUpgradeReason({
                  kind: "feature",
                  feature: `${kind.charAt(0).toUpperCase() + kind.slice(1)} insights`,
                })
              }
            />
            <section className="border border-gray-100/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-3 glow-border">
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
                      type="button"
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
          </div>
        )}
      </div>
      <UpgradeModal
        open={upgradeReason !== null}
        reason={upgradeReason}
        onClose={() => setUpgradeReason(null)}
      />
    </div>
  );
}
