"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Pin,
  Sparkles,
  ListTree,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePrism from "rehype-prism-plus";
import remarkEmoji from "remark-emoji";
import remarkToc from "remark-toc";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import "@/data/css/prism.css";

import type { Note, OutlineHeading, Space } from "@/data/types";
import { markdownComponents } from "@/lib/markdown-components";
import { capitalizeWords } from "@/lib/string";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchNoteSummary } from "@/lib/summary-client";

const remarkPlugins = [remarkGfm, remarkEmoji, remarkToc, remarkMath];
const rehypePlugins: import("unified").PluggableList = [
  rehypeHighlight,
  rehypeSanitize,
  rehypeKatex,
  [rehypePrism, { ignoreMissing: true }],
];

function localOutline(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  for (const line of content.split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) headings.push({ level: match[1].length, text: match[2] });
  }
  return headings;
}

// Cache rows are jsonb — defend against malformed shapes (bad shape, wrong
// types, level out of range, missing text) before we try to render.
function sanitizeOutline(value: unknown): OutlineHeading[] {
  if (!Array.isArray(value)) return [];
  const out: OutlineHeading[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const lvl = Number((item as { level?: unknown }).level);
    const txt = (item as { text?: unknown }).text;
    if (!Number.isInteger(lvl) || lvl < 1 || lvl > 6) continue;
    if (typeof txt !== "string" || txt.length === 0) continue;
    out.push({ level: lvl, text: txt });
    if (out.length >= 200) break; // hard cap on absurd payloads
  }
  return out;
}

type SummaryState = {
  summary: string;
  outline: OutlineHeading[];
  cached: boolean;
  fallback: boolean;
  updated_at: string | null;
};

export default function NoteView({
  note,
  space,
  onClose,
}: {
  note: Note | null;
  space: Space | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"content" | "outline" | "tldr">(
    "content",
  );
  const [state, setState] = useState<SummaryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when switching notes.
  useEffect(() => {
    setState(null);
    setError(null);
    setActiveTab("content");
  }, [note?.id]);

  // Seed from the note's cached summary if present.
  useEffect(() => {
    if (!note) return;
    const cache = note.cache;
    if (
      cache &&
      typeof cache.summary === "string" &&
      cache.summary.length > 0
    ) {
      setState({
        summary: cache.summary,
        outline: sanitizeOutline(cache.outline),
        cached: true,
        fallback: false,
        updated_at: cache.updated_at ?? null,
      });
    }
  }, [note?.id, note?.cache]);

  const load = useCallback(
    async (force = false) => {
      if (!note) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchNoteSummary(note.id, { force });
        setState({
          summary: res.summary,
          outline: sanitizeOutline(res.outline),
          cached: res.cached,
          fallback: Boolean(res.fallback),
          updated_at: res.updated_at ?? null,
        });
      } catch (err) {
        console.error("note summary:", err);
        setError(err instanceof Error ? err.message : "summary_failed");
      } finally {
        setLoading(false);
      }
    },
    [note],
  );

  // Lazy-fetch the first time the user opens outline or tl;dr.
  useEffect(() => {
    if (!note) return;
    if (activeTab === "content") return;
    if (state || loading) return;
    void load(false);
  }, [activeTab, note, state, loading, load]);

  // Fallback outline derived from headings in the raw markdown — shown
  // instantly even before the LLM call returns.
  const outlineForRender = useMemo<OutlineHeading[]>(() => {
    if (state?.outline && state.outline.length > 0) return state.outline;
    return note ? localOutline(note.content) : [];
  }, [state, note]);

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(1200px,95vw)] h-[min(90vh,900px)] rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 glow-border-lg flex flex-col overflow-hidden"
          >
            <header className="flex h-12 items-center justify-between border-b border-gray-100/80 dark:border-zinc-800 px-4 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {space && (
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: space.color }}
                    />
                    <span className="font-medium">{space.name}</span>
                  </div>
                )}
                <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />
                <div className="flex items-center gap-1.5 min-w-0">
                  {note.pinned && (
                    <Pin className="h-3 w-3 text-gray-400 dark:text-zinc-500 flex-shrink-0" />
                  )}
                  <h2 className="text-sm font-medium text-gray-800 dark:text-zinc-100 truncate">
                    {capitalizeWords(note.title)}
                  </h2>
                </div>
                {note.tags.length > 0 && (
                  <>
                    <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />
                    <div className="flex items-center gap-1 overflow-hidden">
                      {note.tags.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] text-gray-600 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 rounded px-1.5 py-0.5"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "content" | "outline" | "tldr")
              }
              className="flex-1 flex flex-col min-h-0 gap-0"
            >
              <div className="flex-shrink-0 border-b border-gray-100/80 dark:border-zinc-800 px-4 py-2 flex items-center justify-between gap-2">
                <TabsList className="bg-gray-100 dark:bg-zinc-800">
                  <TabsTrigger value="content" className="text-xs gap-1.5">
                    <FileText className="h-3 w-3" />
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="outline" className="text-xs gap-1.5">
                    <ListTree className="h-3 w-3" />
                    Outline
                  </TabsTrigger>
                  <TabsTrigger value="tldr" className="text-xs gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    TL;DR
                  </TabsTrigger>
                </TabsList>
                {activeTab !== "content" && (
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-zinc-500">
                    {loading && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Generating…</span>
                      </>
                    )}
                    {!loading && state && (
                      <button
                        onClick={() => load(true)}
                        className="hover:text-gray-700 dark:hover:text-zinc-200 flex items-center gap-1 press"
                        aria-label="Regenerate"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Regenerate
                      </button>
                    )}
                  </div>
                )}
              </div>

              <TabsContent
                value="content"
                className="flex-1 overflow-auto p-6 min-h-0 data-[state=inactive]:hidden"
              >
                <div className="prose prose-zinc dark:prose-invert max-w-none text-sm break-words">
                  {note.content ? (
                    <ReactMarkdown
                      components={markdownComponents}
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={rehypePlugins}
                    >
                      {note.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-gray-400 dark:text-zinc-500 text-sm italic">
                      This note is empty.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent
                value="outline"
                className="flex-1 overflow-auto p-6 min-h-0 data-[state=inactive]:hidden"
              >
                <div className="max-w-3xl mx-auto space-y-4">
                  {error && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {error}
                    </div>
                  )}
                  {outlineForRender.length === 0 ? (
                    <div className="text-xs text-gray-400 dark:text-zinc-500 italic py-12 text-center">
                      No headings detected. Add headings (#, ##, ###) to your
                      note to generate an outline.
                    </div>
                  ) : (
                    <ol className="space-y-1.5">
                      {outlineForRender.map((h, i) => (
                        <li
                          key={`${i}-${h.text}`}
                          className="flex gap-3 text-sm text-gray-700 dark:text-zinc-300 break-words"
                          style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                        >
                          <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 mt-1 flex-shrink-0 w-6">
                            H{h.level}
                          </span>
                          <span className="flex-1 min-w-0 break-words">
                            {h.text}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </TabsContent>

              <TabsContent
                value="tldr"
                className="flex-1 overflow-auto p-6 min-h-0 data-[state=inactive]:hidden"
              >
                <div className="max-w-3xl mx-auto space-y-4">
                  {error && (
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {error}
                    </div>
                  )}
                  {loading && !state ? (
                    <div className="flex items-center justify-center py-12 text-xs text-gray-400 dark:text-zinc-500">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating summary…
                    </div>
                  ) : state?.summary ? (
                    <div className="rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 glow-border">
                      <div className="text-[10px] uppercase tracking-wide font-medium text-gray-400 dark:text-zinc-500 mb-2">
                        Summary
                      </div>
                      <p className="text-sm leading-relaxed text-gray-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                        {state.summary}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 dark:text-zinc-500 italic py-12 text-center">
                      This note is empty — nothing to summarize yet.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
