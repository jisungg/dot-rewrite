"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkEmoji from "remark-emoji";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypePrism from "rehype-prism-plus";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "katex/dist/katex.min.css";
import {
  Mail,
  Send,
  Loader2,
  Calculator,
  Atom,
  Cpu,
  ScrollText,
  Library,
  ExternalLink,
  Sparkles,
  AlertCircle,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";
import type { Space } from "@/data/types";
import { handleQuotaResponse } from "@/lib/quota-toast";

type Discipline = "M" | "S" | "C" | "P" | "H";

type Citation = {
  n: number;
  id: string;
  title: string;
  section: string;
  source_url: string;
  license: string;
  retrieved_at: string;
};

type LetterMessage = {
  id: string;
  role: "user" | "letter";
  content: string;
  citations: Citation[];
  model_segments: Array<{ start: number; end: number }>;
  created_at: string;
};

type LetterMeta = {
  id: Discipline;
  name: string;
  short: string;
  Icon: React.ComponentType<{ className?: string }>;
  blurb: string;
};

const LETTERS: LetterMeta[] = [
  {
    id: "M",
    name: "Mathematics",
    short: "M",
    Icon: Calculator,
    blurb: "Proofs, structures, and quantitative reasoning.",
  },
  {
    id: "S",
    name: "Sciences",
    short: "S",
    Icon: Atom,
    blurb: "Physics, biology, and chemistry: natural-world inquiry.",
  },
  {
    id: "C",
    name: "Computer Science",
    short: "C",
    Icon: Cpu,
    blurb: "Algorithms, systems, languages, machine learning.",
  },
  {
    id: "P",
    name: "Philosophy",
    short: "P",
    Icon: ScrollText,
    blurb: "Knowledge, ethics, mind, and the structure of argument.",
  },
  {
    id: "H",
    name: "History",
    short: "H",
    Icon: Library,
    blurb: "Periods, primary sources, causal threads of the past.",
  },
];

const META_BY_ID: Record<Discipline, LetterMeta> = LETTERS.reduce(
  (acc, l) => {
    acc[l.id] = l;
    return acc;
  },
  {} as Record<Discipline, LetterMeta>,
);

export default function Letters({ allSpaces }: { allSpaces: Space[] }) {
  const [activeLetter, setActiveLetter] = useState<Discipline>("P");
  const [history, setHistory] = useState<LetterMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [streamCitations, setStreamCitations] = useState<Citation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Active space — used as a soft scope hint to the API. v1: just the
  // first space (or none). The Letters tab is global so we don't pin
  // a single space; the API filters notes by engine-classified discipline.
  const activeSpaceId = allSpaces[0]?.id ?? null;

  // Load history for active letter.
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    setHistory([]);
    setStreamBuffer("");
    setStreamCitations([]);
    setError(null);
    (async () => {
      const { data, error: err } = await supabase
        .from("letter_messages")
        .select("id, role, content, citations, model_segments, created_at")
        .eq("discipline", activeLetter)
        .order("created_at", { ascending: true })
        .limit(60);
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoadingHistory(false);
        return;
      }
      setHistory((data ?? []) as LetterMessage[]);
      setLoadingHistory(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeLetter, supabase]);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [history.length, streamBuffer]);

  const send = useCallback(async () => {
    const text = prompt.trim();
    if (!text || streaming) return;
    setError(null);
    const userMsg: LetterMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      citations: [],
      model_segments: [],
      created_at: new Date().toISOString(),
    };
    setHistory((h) => [...h, userMsg]);
    setPrompt("");
    setStreaming(true);
    setStreamBuffer("");
    setStreamCitations([]);

    try {
      const res = await fetch("/api/letters/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          discipline: activeLetter,
          prompt: text,
          spaceId: activeSpaceId,
        }),
      });

      handleQuotaResponse(res, "Letters");
      if (!res.ok) {
        const errText = await res.text().catch(() => `${res.status}`);
        throw new Error(errText || `request failed (${res.status})`);
      }

      const redirect = res.headers.get("x-letter-redirect");
      const citationsHeader = res.headers.get("x-letter-citations");
      let citations: Citation[] = [];
      if (citationsHeader) {
        try {
          const decoded =
            typeof window === "undefined"
              ? Buffer.from(citationsHeader, "base64").toString("utf-8")
              : atob(citationsHeader);
          citations = JSON.parse(decoded) as Citation[];
        } catch {
          citations = [];
        }
      }
      setStreamCitations(citations);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          setStreamBuffer(buffer);
        }
      }

      // Promote stream into history.
      const final: LetterMessage = {
        id: `local-${Date.now()}-letter`,
        role: "letter",
        content: buffer,
        citations,
        model_segments: [],
        created_at: new Date().toISOString(),
      };
      setHistory((h) => [...h, final]);
      setStreamBuffer("");

      if (redirect) {
        // Don't auto-switch — just surface the suggestion in the UI; the
        // user clicks it themselves so the switch is intentional.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
    }
  }, [prompt, streaming, activeLetter, activeSpaceId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Letters
          </h2>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            · five expert agents grounded in curated public corpora
          </span>
        </div>
        <LetterPicker active={activeLetter} onPick={setActiveLetter} />
      </div>

      <div className="flex-1 flex gap-3 px-6 pb-4 min-h-0">
        <main className="flex-1 flex flex-col border border-gray-100/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 overflow-hidden glow-border-lg">
          <header className="px-4 py-3 border-b border-gray-100/80 dark:border-zinc-800 flex items-center gap-2">
            <ActiveBadge letter={META_BY_ID[activeLetter]} />
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {META_BY_ID[activeLetter].blurb}
            </div>
          </header>

          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {loadingHistory ? (
              <>
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-16 w-3/4 ml-auto" />
                <Skeleton className="h-12 w-1/2" />
              </>
            ) : history.length === 0 && !streamBuffer ? (
              <EmptyState letter={META_BY_ID[activeLetter]} />
            ) : null}

            {history.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onRedirect={(d) => setActiveLetter(d)}
              />
            ))}

            {streaming && (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "letter",
                  content: streamBuffer || "…",
                  citations: streamCitations,
                  model_segments: [],
                  created_at: new Date().toISOString(),
                }}
                streaming
                onRedirect={(d) => setActiveLetter(d)}
              />
            )}
          </div>

          {error && (
            <div className="px-4 py-2 border-t border-red-200/60 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 text-[11px] text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {error}
            </div>
          )}

          <footer className="border-t border-gray-100/80 dark:border-zinc-800 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                disabled={streaming}
                placeholder={`Ask Letter ${activeLetter} about your ${META_BY_ID[activeLetter].name.toLowerCase()} notes…`}
                className="flex-1 resize-none bg-transparent text-[13px] text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none px-3 py-2 rounded-md border border-gray-100/80 dark:border-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-600"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!prompt.trim() || streaming}
                className="h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white text-[12px] font-medium inline-flex items-center gap-1 transition-colors"
              >
                {streaming ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ---------- subcomponents ----------

function LetterPicker({
  active,
  onPick,
}: {
  active: Discipline;
  onPick: (d: Discipline) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {LETTERS.map((l) => {
        const isActive = l.id === active;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onPick(l.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
              isActive
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                : "bg-white dark:bg-zinc-900 border-gray-100/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
            aria-pressed={isActive}
          >
            <span
              className={`h-7 w-7 rounded-md font-mono text-[13px] font-semibold inline-flex items-center justify-center ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {l.short}
            </span>
            <div className="text-left">
              <div className="text-[12px] font-medium leading-tight">
                {l.name}
              </div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                Letter {l.id}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActiveBadge({ letter }: { letter: LetterMeta }) {
  const { Icon } = letter;
  return (
    <div className="flex items-center gap-2">
      <span className="h-7 w-7 rounded-md bg-blue-600 text-white font-mono text-[13px] font-semibold inline-flex items-center justify-center">
        {letter.short}
      </span>
      <div>
        <div className="text-[12px] font-medium text-zinc-800 dark:text-zinc-100 leading-tight inline-flex items-center gap-1">
          <Icon className="h-3 w-3" />
          Letter {letter.id} · {letter.name}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ letter }: { letter: LetterMeta }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8 text-zinc-500 dark:text-zinc-400">
      <Sparkles className="h-5 w-5 text-blue-500/70 dark:text-blue-400/70 mb-2" />
      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Ask Letter {letter.id} about {letter.name.toLowerCase()}.
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  streaming = false,
  onRedirect,
}: {
  message: LetterMessage;
  streaming?: boolean;
  onRedirect: (d: Discipline) => void;
}) {
  const isUser = message.role === "user";
  // Detect REDIRECT:X
  const redirectMatch =
    !isUser && /^REDIRECT:([MSCPH])$/.exec(message.content.trim());
  if (redirectMatch) {
    const target = redirectMatch[1] as Discipline;
    const targetMeta = META_BY_ID[target];
    return (
      <div className="flex">
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-[12px] text-amber-800 dark:text-amber-200 max-w-[85%]">
          <div className="font-medium">
            That looks like a {targetMeta.name} question.
          </div>
          <div className="mt-1 text-[11px] opacity-80">
            Letter {message.role === "letter" ? "is" : "was"} kept in scope. Try
            Letter {target}?
          </div>
          <button
            type="button"
            onClick={() => onRedirect(target)}
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 text-[11px] font-medium"
          >
            Switch to Letter {target}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-lg p-3 max-w-[85%] text-[13px] leading-relaxed break-words ${
          isUser
            ? "bg-blue-600 text-white whitespace-pre-wrap"
            : "bg-gray-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border border-gray-100/80 dark:border-zinc-800"
        }`}
      >
        {isUser ? (
          message.content
        ) : (
          <LetterMarkdown
            text={message.content}
            citations={message.citations}
          />
        )}
        {!isUser && message.citations.length > 0 && !streaming && (
          <CitationsList citations={message.citations} />
        )}
        {streaming && (
          <span className="inline-block ml-1 w-2 h-3 bg-zinc-400 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

// Pre-process the letter's response so ReactMarkdown can render math, code,
// and lists correctly while still surfacing [n] citations as clickable links.
//
//   [1] → [\[1\]](cite:1)   (markdown link to a synthetic cite: href)
//
// We also defensively scrub any leftover "(model: ...)" wrapper, bracketed
// "[model] ..." marker, or trailing "Sources:" / "References:" block the
// model might still emit while the rule rolls out — the source list is
// rendered separately by the UI from the [n] markers.
//
// Code regions (fenced ``` and inline `) are skipped during preprocessing
// so [0]-style indices in code samples are left alone.
const CITE_RE = /\[(\d+)\]/g;
const MODEL_PARENS_RE = /\(model:\s*([^)]*)\)/gi;
const MODEL_BRACKET_RE = /\[\s*model\s*\]\s*:?\s*/gi;
const TRAILING_SOURCES_RE =
  /\n+\s*(?:#{1,6}\s*)?(?:sources|references)\s*:?[\s\S]*$/i;

function scrubModelArtifacts(text: string): string {
  let out = text.replace(MODEL_PARENS_RE, (_m, inner) => String(inner).trim());
  out = out.replace(MODEL_BRACKET_RE, "");
  out = out.replace(TRAILING_SOURCES_RE, "").trimEnd();
  return out;
}

function preprocessLetterMarkdown(text: string): string {
  // Walk char-by-char tracking whether we're inside a fenced code block
  // or inline code so we don't mangle code samples that contain [1] etc.
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text.startsWith("```", i)) {
      const end = text.indexOf("```", i + 3);
      const stop = end >= 0 ? end + 3 : text.length;
      out += text.slice(i, stop);
      i = stop;
      continue;
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      const stop = end >= 0 ? end + 1 : text.length;
      out += text.slice(i, stop);
      i = stop;
      continue;
    }
    const nextFence = text.indexOf("```", i);
    const nextInline = text.indexOf("`", i);
    let next = text.length;
    if (nextFence >= 0) next = Math.min(next, nextFence);
    if (nextInline >= 0) next = Math.min(next, nextInline);
    let segment = text.slice(i, next);
    segment = scrubModelArtifacts(segment);
    segment = segment.replace(CITE_RE, (_m, n) => `[\\[${n}\\]](cite:${n})`);
    out += segment;
    i = next;
  }
  return out;
}

// GitHub-default sanitize schema — no extra tags needed now that we no
// longer inject <mark>.
const SANITIZE_SCHEMA = defaultSchema;

function LetterMarkdown({
  text,
  citations,
}: {
  text: string;
  citations: Citation[];
}) {
  const processed = useMemo(() => preprocessLetterMarkdown(text), [text]);
  const citationsByN = useMemo(() => {
    const m = new Map<number, Citation>();
    for (const c of citations) m.set(c.n, c);
    return m;
  }, [citations]);

  return (
    <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none break-words prose-p:my-2 prose-li:my-0.5 prose-pre:my-2 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, SANITIZE_SCHEMA],
          rehypeKatex,
          [rehypePrism, { ignoreMissing: true }],
        ]}
        components={{
          ul: ({ children, ...props }) => (
            <ul
              className="list-disc pl-5 my-2 space-y-1 marker:text-zinc-400 dark:marker:text-zinc-500"
              {...props}
            >
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol
              className="list-decimal pl-5 my-2 space-y-1 marker:text-zinc-400 dark:marker:text-zinc-500"
              {...props}
            >
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed [&>p]:my-0" {...props}>
              {children}
            </li>
          ),
          a: (props) => {
            const { href, children } = props as {
              href?: string;
              children?: React.ReactNode;
            };
            if (typeof href === "string" && href.startsWith("cite:")) {
              const n = Number(href.slice(5));
              const c = citationsByN.get(n);
              if (c) {
                return (
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 underline decoration-dotted text-[11px] align-super mx-0.5"
                    title={`${c.title}${c.section ? ": " + c.section : ""}\n${c.source_url}\n${c.license}`}
                  >
                    [{n}]
                  </a>
                );
              }
              return (
                <span className="text-[11px] align-super mx-0.5">[{n}]</span>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

function CitationsList({ citations }: { citations: Citation[] }) {
  return (
    <div className="mt-3 pt-2 border-t border-zinc-200/70 dark:border-zinc-800 space-y-1">
      {citations.map((c) => (
        <a
          key={c.id}
          href={c.source_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-1.5 text-[10.5px] text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
          title={`${c.license} · retrieved ${c.retrieved_at.slice(0, 10)}`}
        >
          <span className="font-mono opacity-60 flex-shrink-0">[{c.n}]</span>
          <span className="truncate flex-1 min-w-0">
            <span className="font-medium">{c.title}</span>
            {c.section ? (
              <span className="opacity-70"> · {c.section}</span>
            ) : null}
          </span>
          <ExternalLink className="h-2.5 w-2.5 opacity-50 group-hover:opacity-100 flex-shrink-0" />
        </a>
      ))}
    </div>
  );
}
