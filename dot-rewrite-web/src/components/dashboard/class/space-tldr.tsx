"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, ScanText, Search, Copy, Check } from "lucide-react";

import type { Note, Space } from "@/data/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const plain = stripMd(note.content);
  if (!plain) return "";
  return truncate(plain, 280);
}

function buildSpaceSummary(notes: Note[], space: Space): string {
  if (notes.length === 0) return "";
  const tagCounts: Record<string, number> = {};
  for (const n of notes) {
    for (const t of n.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => `#${t}`);

  const totalWords = notes.reduce(
    (sum, n) => sum + stripMd(n.content).split(/\s+/).filter(Boolean).length,
    0,
  );

  const lines: string[] = [];
  lines.push(
    `${space.name} has ${notes.length} note${notes.length === 1 ? "" : "s"} totaling roughly ${totalWords.toLocaleString()} word${totalWords === 1 ? "" : "s"}.`,
  );
  if (topTags.length > 0) {
    lines.push(`Recurring themes: ${topTags.join(", ")}.`);
  }
  const titles = notes
    .slice(0, 3)
    .map((n) => n.title || "Untitled Note")
    .join(", ");
  if (titles) {
    lines.push(`Most recent entries include ${titles}.`);
  }
  return lines.join(" ");
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

  const spaceSummary = useMemo(
    () => buildSpaceSummary(userNotes, focusedSpace),
    [userNotes, focusedSpace],
  );

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1400);
    } catch {
      // silent
    }
  };

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
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-md border border-dashed border-gray-100/80 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-3 py-2"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                Space-wide summary
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                AI-generated summary coming soon. Showing heuristic overview and
                per-note excerpts for now.
              </p>
            </div>
          </motion.div>

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
                    <div className="text-[10px] uppercase tracking-wide font-medium text-zinc-400 dark:text-zinc-500">
                      Space Summary
                    </div>
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
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 break-words whitespace-pre-wrap">
                    {spaceSummary}
                  </p>
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
