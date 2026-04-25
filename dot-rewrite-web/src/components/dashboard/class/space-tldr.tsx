"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ScanText,
  Search,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";

import type { Note, Space } from "@/data/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchSpaceSummary } from "@/lib/summary-client";
import { useEngineUpdates } from "@/lib/engine-events";

function stripMd(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function buildNoteSummary(note: Note): string {
  const cached = note.cache?.summary;
  if (cached && cached.length > 0) return cached;
  const plain = stripMd(note.content);
  if (!plain) return "";
  return truncate(plain, 280);
}

type SpaceSummaryState = {
  summary: string;
  cached: boolean;
  fallback: boolean;
  detail: string | null;
  updated_at: string | null;
  // Client-side signature of the note set at the time the summary was
  // taken. Used to gate the Regenerate button: it's only enabled when the
  // current note set differs from this signature (i.e. a note was added,
  // edited, archived, or moved).
  signature: string;
};

function noteSetSignature(notes: Note[]): string {
  return notes
    .map((n) => `${n.id}:${n.last_modified_at ?? n.created_at ?? ""}`)
    .sort()
    .join("|");
}

export default function SpaceTldr({
  focusedSpace,
  userNotes,
}: {
  focusedSpace: Space;
  userNotes: Note[];
  allSpaces?: Space[];
  allNotes?: Note[];
}) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [state, setState] = useState<SpaceSummaryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Auto-refresh after engine processing finishes for this space.
  useEngineUpdates((d) => {
    if (!d.space_id || d.space_id === focusedSpace.id) {
      setState(null);
      setError(null);
    }
  });

  // Seed immediately from any cached summary on the space row.
  useEffect(() => {
    const c = focusedSpace.summary_cache;
    if (c && typeof c.summary === "string" && c.summary.length > 0) {
      setState({
        summary: c.summary,
        cached: true,
        fallback: false,
        detail: null,
        updated_at: c.updated_at ?? null,
        signature: noteSetSignature(userNotes),
      });
    } else {
      setState(null);
    }
    setError(null);
  }, [focusedSpace.id, focusedSpace.summary_cache]);

  const load = useCallback(
    async (force = false) => {
      if (userNotes.length === 0) {
        setState({
          summary: "",
          cached: false,
          fallback: false,
          detail: null,
          updated_at: null,
          signature: noteSetSignature(userNotes),
        });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetchSpaceSummary(focusedSpace.id, { force });
        setState({
          summary: res.summary,
          cached: res.cached,
          fallback: Boolean(res.fallback),
          detail: res.detail ?? null,
          updated_at: res.updated_at ?? null,
          signature: noteSetSignature(userNotes),
        });
      } catch (err) {
        console.error("space summary:", err);
        setError(err instanceof Error ? err.message : "summary_failed");
      } finally {
        setLoading(false);
      }
    },
    [focusedSpace.id, userNotes.length],
  );

  // Lazy-fetch on mount / space change if not already seeded.
  useEffect(() => {
    if (state || loading) return;
    if (userNotes.length === 0) return;
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedSpace.id, userNotes.length]);

  const summaries = useMemo(
    () =>
      userNotes.map((n) => ({
        note: n,
        summary: buildNoteSummary(n),
      })),
    [userNotes],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return summaries;
    const q = query.toLowerCase();
    return summaries.filter(
      ({ note, summary }) =>
        note.title.toLowerCase().includes(q) ||
        summary.toLowerCase().includes(q) ||
        note.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [summaries, query]);

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch {
      // silent
    }
  };

  const spaceSummary = state?.summary ?? "";
  const currentSignature = useMemo(
    () => noteSetSignature(userNotes),
    [userNotes],
  );
  const hasNewNotes =
    !state || (state.signature !== currentSignature && !state.fallback);
  const canRegenerate =
    !loading && userNotes.length > 0 && (hasNewNotes || !state);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100/80 dark:border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: focusedSpace.color }}
          />
          <h1 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {focusedSpace.name}
          </h1>
          <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-medium">
            tl;dr
          </span>
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {userNotes.length} note{userNotes.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-5">
          {userNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-100/80 dark:border-zinc-700 p-10 text-center">
              <ScanText className="h-5 w-5 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Nothing to summarize yet
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Add notes to this space to see a TL;DR.
              </div>
            </div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden glow-border-lg"
              >
                <div
                  className="h-1 w-full"
                  style={{ backgroundColor: focusedSpace.color }}
                />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] uppercase tracking-wide font-medium text-zinc-400 dark:text-zinc-500">
                        Space Summary
                      </div>
                      {loading && (
                        <Loader2 className="h-3 w-3 animate-spin text-zinc-400 dark:text-zinc-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => load(true)}
                        disabled={!canRegenerate}
                        title={
                          canRegenerate
                            ? "Regenerate summary"
                            : "Already up to date — add or edit a note to enable."
                        }
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                        />
                        Regenerate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => copy("__space__", spaceSummary)}
                        disabled={!spaceSummary}
                      >
                        {copiedId === "__space__" ? (
                          <>
                            <Check className="h-3 w-3" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {error && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 mb-2">
                      {error}
                    </div>
                  )}
                  {state?.fallback && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">
                      Couldn&apos;t generate a fresh summary right now.
                    </div>
                  )}
                  {loading && !spaceSummary ? (
                    <p className="text-[13px] italic text-zinc-400 dark:text-zinc-500">
                      Generating…
                    </p>
                  ) : spaceSummary ? (
                    <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 break-words whitespace-pre-wrap">
                      {spaceSummary}
                    </p>
                  ) : (
                    <p className="text-[13px] italic text-zinc-400 dark:text-zinc-500">
                      No summary yet — regenerate to build one.
                    </p>
                  )}
                </div>
              </motion.div>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search summaries..."
                  className="pl-8 h-9 text-xs border-gray-100/80 dark:border-zinc-700"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Per-note summaries
                  </h3>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {filtered.length} shown
                  </span>
                </div>
                {filtered.length === 0 ? (
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 italic text-center py-6">
                    No summaries match your query.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {filtered.map(({ note, summary }) => (
                      <li
                        key={note.id}
                        className="rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 glow-border"
                      >
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100 truncate">
                              {note.title || "Untitled Note"}
                            </span>
                            {note.tags.length > 0 && (
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                                {note.tags
                                  .slice(0, 3)
                                  .map((t) => `#${t}`)
                                  .join(" ")}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1 flex-shrink-0"
                            onClick={() => copy(note.id, summary)}
                            disabled={!summary}
                          >
                            {copiedId === note.id ? (
                              <>
                                <Check className="h-3 w-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        {summary ? (
                          <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-300 break-words whitespace-pre-wrap">
                            {summary}
                          </p>
                        ) : (
                          <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
                            This note is empty — nothing to summarize.
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
