"use client";

import { useMemo, useState } from "react";
import {
  Sparkles,
  GitBranch,
  Crown,
  AlertTriangle,
  Workflow,
  ScanSearch,
  Layers,
  AlertCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  NexusInsight,
  NexusInsightKind,
  NexusSnapshot,
} from "@/data/types";
import { useInsightDetail } from "@/lib/use-nexus-snapshot";

type Props = {
  snapshot: NexusSnapshot;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  onFocus: (noteIds: string[]) => void;
};

type Section = {
  kind: NexusInsightKind;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const SECTIONS: Section[] = [
  { kind: "bridge", label: "Bridges", Icon: GitBranch },
  { kind: "god", label: "Anchor notes", Icon: Crown },
  { kind: "chain", label: "Dependency chains", Icon: Workflow },
  { kind: "contradiction", label: "Contradictions", Icon: AlertTriangle },
  { kind: "reach", label: "Concept reach", Icon: ScanSearch },
  { kind: "emerging", label: "Emerging clusters", Icon: Layers },
  { kind: "orphan", label: "Orphans", Icon: AlertCircle },
];

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function summarize(insight: NexusInsight): string {
  const p = insight.payload || {};
  switch (insight.kind) {
    case "bridge":
      return asString(p["title"], "untitled note");
    case "god":
      return asString(p["title"], "untitled note");
    case "orphan": {
      const count = asNumber(p["count"]);
      return `${count} disconnected note${count === 1 ? "" : "s"}`;
    }
    case "contradiction":
      return `${asString(p["src_title"], "?")} ↔ ${asString(p["dst_title"], "?")}`;
    case "chain": {
      const titles = asArray<string>(p["titles"]);
      if (titles.length === 0) return "dependency chain";
      return titles.join(" → ");
    }
    case "reach": {
      const surface = asString(p["surface"]);
      const comms = asArray<string>(p["communities"]).length;
      return `“${surface}” spans ${comms} communities`;
    }
    case "emerging":
      return asString(p["label"], "new cluster forming");
    default:
      return "";
  }
}

function focusableNoteIds(insight: NexusInsight): string[] {
  const p = insight.payload || {};
  switch (insight.kind) {
    case "bridge":
    case "god":
      return [asString(p["note_id"])].filter(Boolean);
    case "orphan":
      return asArray<{ note_id?: string }>(p["notes"])
        .map((n) => asString(n?.note_id))
        .filter(Boolean);
    case "contradiction":
      return [asString(p["src_note_id"]), asString(p["dst_note_id"])].filter(Boolean);
    case "chain":
      return asArray<string>(p["note_ids"]).filter(Boolean);
    case "reach":
    case "emerging":
      return [];
  }
}

export default function NexusInsightsPanel({ snapshot, status, error, onFocus }: Props) {
  const [openInsightId, setOpenInsightId] = useState<string | null>(null);
  const detail = useInsightDetail(openInsightId);

  const grouped = useMemo(() => {
    const m = new Map<NexusInsightKind, NexusInsight[]>();
    for (const i of snapshot.insights_top) {
      const arr = m.get(i.kind) ?? [];
      arr.push(i);
      m.set(i.kind, arr);
    }
    return m;
  }, [snapshot.insights_top]);

  if (status === "loading") {
    return (
      <aside className="w-80 flex-shrink-0 border border-gray-100/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-y-auto glow-border-lg p-3 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </aside>
    );
  }

  return (
    <aside className="w-80 flex-shrink-0 border border-gray-100/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-y-auto glow-border-lg">
      <div className="p-3 border-b border-gray-100/80 dark:border-zinc-800 flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-zinc-800 dark:text-zinc-100">
            Insights
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {snapshot.insights_top.length === 0
              ? "Process notes to surface bridges, anchors, and contradictions."
              : "Questions only the graph can answer. Click any card to focus the graph."}
          </div>
          {error && (
            <div className="mt-1 text-[10px] text-red-500 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>

      {SECTIONS.map(({ kind, label, Icon }) => {
        const items = grouped.get(kind) ?? [];
        if (items.length === 0) return null;
        return (
          <section
            key={kind}
            className="p-3 border-b border-gray-100/80 dark:border-zinc-800"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Icon className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {label}
              </h3>
              <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">
                {items.length}
              </span>
            </div>
            <ul className="space-y-1">
              {items.slice(0, 6).map((insight) => {
                const isOpen = openInsightId === insight.id;
                return (
                  <li key={insight.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenInsightId(isOpen ? null : insight.id);
                        const ids = focusableNoteIds(insight);
                        if (ids.length > 0) onFocus(ids);
                      }}
                      className={`w-full text-left rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                        isOpen
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200"
                          : "text-zinc-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronRight
                          className={`h-3 w-3 flex-shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                        <span className="truncate flex-1 min-w-0">
                          {summarize(insight)}
                        </span>
                      </div>
                      {isOpen && (
                        <div className="mt-1 pl-4 text-[10px] text-zinc-500 dark:text-zinc-400 space-y-1">
                          {detail.status === "loading" && (
                            <span className="inline-flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> loading…
                            </span>
                          )}
                          {detail.status === "ready" &&
                            renderDetail(detail.data ?? insight)}
                          {detail.status === "error" && (
                            <span>Failed to load detail.</span>
                          )}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

function renderDetail(insight: NexusInsight) {
  const p = insight.payload || {};
  switch (insight.kind) {
    case "contradiction":
      return (
        <>
          <div>{`evidence: “${asString(p["evidence"], "—")}”`}</div>
          <div>{`confidence: ${(asNumber(p["confidence"]) * 100).toFixed(0)}% (${asString(p["source"], "?")})`}</div>
        </>
      );
    case "reach": {
      const comms = asArray<string>(p["communities"]);
      const noteCount = asNumber(p["note_count"]);
      return (
        <>
          <div>{`${noteCount} mentions across ${comms.length} communities`}</div>
        </>
      );
    }
    case "chain": {
      const titles = asArray<string>(p["titles"]);
      return <div>{titles.join(" → ") || "—"}</div>;
    }
    case "god":
      return (
        <div>{`pagerank ${asNumber(p["pagerank"]).toFixed(3)} · degree ${asNumber(p["degree"])}`}</div>
      );
    case "bridge":
      return (
        <div>{`betweenness ${asNumber(p["betweenness"]).toFixed(3)}`}</div>
      );
    case "emerging": {
      const kw = asArray<string>(p["keywords"]);
      return (
        <div>
          {asNumber(p["note_count"])} notes · {kw.slice(0, 4).join(", ") || "—"}
        </div>
      );
    }
    case "orphan": {
      const items = asArray<{ title?: string }>(p["notes"]).slice(0, 8);
      return (
        <ul className="space-y-0.5">
          {items.map((n, i) => (
            <li key={i} className="truncate">
              {asString(n?.title, "Untitled")}
            </li>
          ))}
          {asNumber(p["count"]) > items.length && (
            <li className="opacity-70">
              + {asNumber(p["count"]) - items.length} more
            </li>
          )}
        </ul>
      );
    }
    default:
      return null;
  }
}
