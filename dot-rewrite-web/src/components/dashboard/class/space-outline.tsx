"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  TextQuote,
  ChevronRight,
  ChevronDown,
  Search,
} from "lucide-react";

import type { Note, Space } from "@/data/types";
import { Input } from "@/components/ui/input";

type Heading = { level: number; text: string };

function extractHeadings(content: string): Heading[] {
  const out: Heading[] = [];
  for (const line of content.split("\n")) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2] });
  }
  return out;
}

export default function SpaceOutline({
  focusedSpace,
  userNotes,
}: {
  focusedSpace: Space;
  userNotes: Note[];
  allSpaces?: Space[];
  allNotes?: Note[];
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const perNote = useMemo(() => {
    return userNotes.map((n) => ({
      note: n,
      headings: extractHeadings(n.content),
    }));
  }, [userNotes]);

  const filtered = useMemo(() => {
    if (!query.trim()) return perNote;
    const q = query.toLowerCase();
    return perNote
      .map((entry) => {
        const matchesTitle = entry.note.title.toLowerCase().includes(q);
        const matchedHeadings = entry.headings.filter((h) =>
          h.text.toLowerCase().includes(q),
        );
        if (matchesTitle) return entry;
        if (matchedHeadings.length > 0)
          return { ...entry, headings: matchedHeadings };
        return null;
      })
      .filter((x): x is (typeof perNote)[number] => x !== null);
  }, [perNote, query]);

  const totalHeadings = perNote.reduce((sum, e) => sum + e.headings.length, 0);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            outline
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{userNotes.length} notes</span>
          <span className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
          <span>{totalHeadings} headings</span>
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
                Space-wide outline
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                AI-generated outline coming soon. Showing heading structure
                detected across every note in this space.
              </p>
            </div>
          </motion.div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headings or notes in this space..."
              className="pl-8 h-9 text-xs border-gray-100/80 dark:border-zinc-700"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-100/80 dark:border-zinc-700 p-10 text-center">
              <TextQuote className="h-5 w-5 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {userNotes.length === 0
                  ? "No notes in this space yet"
                  : "No matching headings"}
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                {userNotes.length === 0
                  ? "Add notes to this space to build an outline."
                  : "Try a different query or add headings (#, ##, ###) to your notes."}
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {filtered.map(({ note, headings }) => {
                const isCollapsed = collapsed.has(note.id);
                return (
                  <li
                    key={note.id}
                    className="rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden glow-border"
                  >
                    <button
                      onClick={() => toggle(note.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                        )}
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
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 flex-shrink-0 bg-gray-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                        {headings.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <div className="px-4 pb-3 pt-0">
                        {headings.length === 0 ? (
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 italic pl-5 py-2">
                            No headings in this note.
                          </div>
                        ) : (
                          <ol className="space-y-1 pl-1">
                            {headings.map((h, i) => (
                              <li
                                key={`${note.id}-${i}-${h.text}`}
                                className="flex gap-3 text-[13px] text-zinc-700 dark:text-zinc-300 break-words"
                                style={{
                                  paddingLeft: `${(h.level - 1) * 16}px`,
                                }}
                              >
                                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 mt-1 flex-shrink-0 w-5">
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
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
