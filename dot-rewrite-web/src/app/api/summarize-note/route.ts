import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { createClient } from "@/utils/supabase/server";
import type { Note, NoteCache, OutlineHeading } from "@/data/types";
import { backendName, completeJson } from "@/lib/llm-backend";

// On-demand per-note summary. One call per user click at most, and
// results are cached on `notes.cache` keyed by a content hash — a
// follow-up open of the same note, with the same content, returns the
// cached value with zero API calls.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_CHARS = 8000;

const SYSTEM_PROMPT = `You summarize a single markdown note into a compact TL;DR plus a short outline.

Rules:
- TL;DR: exactly one or two sentences. Plain prose. Concrete. No preamble, no "This note…", no markdown, no bullets.
- Outline: the note's heading structure, in document order. For each heading output {level, text} with level 1-6. Do NOT invent headings that aren't in the note. If the note has no headings, return an empty array.
- Ignore markdown formatting, LaTeX commands, and code boilerplate. Focus on subject-matter meaning.
- If the note is empty, trivial, or unintelligible, return a summary of "" and an empty outline — never guess.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: { type: "string" as const },
    outline: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          level: { type: "integer" as const },
          text: { type: "string" as const },
        },
        required: ["level", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "outline"],
  additionalProperties: false,
};

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)\s]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)\s]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashContent(note: Pick<Note, "title" | "content">, model: string): string {
  return createHash("sha1")
    .update(model)
    .update("\0")
    .update(note.title ?? "")
    .update("\0")
    .update(note.content ?? "")
    .digest("hex");
}

type SummaryPayload = { summary: string; outline: OutlineHeading[] };

function fallbackOutline(content: string): OutlineHeading[] {
  const out: OutlineHeading[] = [];
  for (const line of content.split("\n")) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2] });
  }
  return out;
}

function fallbackSummary(content: string): string {
  const plain = stripMarkdown(content);
  if (!plain) return "";
  return plain.length > 280 ? plain.slice(0, 277) + "…" : plain;
}

export async function POST(req: Request) {
  let body: { noteId?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const noteId = body.noteId;
  if (!noteId) {
    return NextResponse.json({ error: "missing_note_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: noteRow, error: readErr } = await supabase
    .from("notes")
    .select("id, title, content, cache")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!noteRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const note = noteRow as Pick<Note, "id" | "title" | "content"> & {
    cache?: NoteCache | null;
  };
  const backend = backendName();
  // Use the backend name as part of the hash so switching backends forces a
  // one-time re-summarize, and stored summaries don't mix provider outputs.
  const hash = hashContent(note, `summary:${backend}`);
  const cached = (note.cache ?? null) as NoteCache | null;

  if (
    !body.force &&
    cached?.content_hash === hash &&
    typeof cached.summary === "string"
  ) {
    return NextResponse.json({
      cached: true,
      summary: cached.summary,
      outline: cached.outline ?? [],
      updated_at: cached.updated_at ?? null,
    });
  }

  const content = (note.content ?? "").slice(0, MAX_CONTENT_CHARS);
  const userMessage = JSON.stringify({ title: note.title, content });

  const result = await completeJson<SummaryPayload>({
    task: "summarizer",
    system: SYSTEM_PROMPT,
    user: userMessage,
    schema: OUTPUT_SCHEMA,
    maxTokens: 800,
    anthropicDefaultModel: "claude-haiku-4-5",
    ollamaDefaultModel: "qwen2.5:7b-instruct",
  });

  if (!result.ok) {
    console.error("summarize-note: LLM call failed:", result.error);
    return NextResponse.json({
      cached: false,
      fallback: true,
      summary: fallbackSummary(note.content ?? ""),
      outline: fallbackOutline(note.content ?? ""),
      detail: result.error,
    });
  }

  const parsed = result.data;
  const nextCache: NoteCache = {
    ...(cached ?? {}),
    summary: parsed.summary ?? "",
    outline: Array.isArray(parsed.outline) ? parsed.outline : [],
    content_hash: hash,
    updated_at: new Date().toISOString(),
  };

  const { error: writeErr } = await supabase
    .from("notes")
    .update({ cache: nextCache })
    .eq("id", noteId)
    .eq("user_id", user.id);
  if (writeErr) {
    console.error("summarize-note: cache write failed:", writeErr);
  }

  return NextResponse.json({
    cached: false,
    summary: nextCache.summary ?? "",
    outline: nextCache.outline ?? [],
    updated_at: nextCache.updated_at,
    backend,
    model: result.model,
  });
}
