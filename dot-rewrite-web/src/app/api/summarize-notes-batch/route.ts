import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { createClient } from "@/utils/supabase/server";
import type { Note, NoteCache, OutlineHeading } from "@/data/types";
import { backendName, completeJson } from "@/lib/llm-backend";

// Batch per-note summarizer. Fires once per space right after the engine
// finishes an analyze run, so by the time the user clicks a note it's
// already cached in notes.cache.
//
// Concurrency is capped to avoid blowing the rate limit for users with
// dozens of new notes. Notes whose content_hash already matches the cache
// are skipped — we never re-summarize an unchanged note.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_CHARS = 8000;
const CONCURRENCY = 4;

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

type NoteRow = Pick<Note, "id" | "title" | "content"> & {
  cache?: NoteCache | null;
};

function hashContent(note: Pick<Note, "title" | "content">, model: string): string {
  return createHash("sha1")
    .update(model)
    .update("\0")
    .update(note.title ?? "")
    .update("\0")
    .update(note.content ?? "")
    .digest("hex");
}

async function summarizeOne(
  note: NoteRow,
  backend: string,
): Promise<{
  noteId: string;
  ok: boolean;
  cache?: NoteCache;
  error?: string;
  skipped?: boolean;
}> {
  const hash = hashContent(note, `summary:${backend}`);
  if (note.cache?.content_hash === hash && typeof note.cache.summary === "string") {
    return { noteId: note.id, ok: true, skipped: true };
  }
  const content = (note.content ?? "").slice(0, MAX_CONTENT_CHARS);
  const result = await completeJson<{ summary: string; outline: OutlineHeading[] }>({
    task: "summarizer",
    system: SYSTEM_PROMPT,
    user: JSON.stringify({ title: note.title, content }),
    schema: OUTPUT_SCHEMA,
    maxTokens: 800,
    anthropicDefaultModel: "claude-haiku-4-5",
    ollamaDefaultModel: "qwen2.5:7b-instruct",
  });
  if (!result.ok) {
    return { noteId: note.id, ok: false, error: result.error };
  }
  const cache: NoteCache = {
    ...(note.cache ?? {}),
    summary: result.data.summary ?? "",
    outline: Array.isArray(result.data.outline) ? result.data.outline : [],
    content_hash: hash,
    updated_at: new Date().toISOString(),
  };
  return { noteId: note.id, ok: true, cache };
}

export async function POST(req: Request) {
  let body: { spaceIds?: string[]; noteIds?: string[]; onlyStale?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let query = supabase
    .from("notes")
    .select("id, title, content, cache")
    .eq("user_id", user.id)
    .eq("archived", false);

  if (body.noteIds && body.noteIds.length > 0) {
    query = query.in("id", body.noteIds);
  } else if (body.spaceIds && body.spaceIds.length > 0) {
    query = query.in("space_id", body.spaceIds);
  } else {
    return NextResponse.json({ error: "missing_scope" }, { status: 400 });
  }

  const { data: noteRows, error: readErr } = await query;
  if (readErr) {
    return NextResponse.json(
      { error: "read_failed", detail: readErr.message },
      { status: 500 },
    );
  }

  const backend = backendName();
  const notes = (noteRows ?? []) as NoteRow[];
  const onlyStale = body.onlyStale ?? true;

  const needsWork: NoteRow[] = [];
  const stats = { total: notes.length, skipped: 0, processed: 0, failed: 0 };
  for (const n of notes) {
    const hash = hashContent(n, `summary:${backend}`);
    if (
      onlyStale &&
      n.cache?.content_hash === hash &&
      typeof n.cache.summary === "string"
    ) {
      stats.skipped += 1;
      continue;
    }
    needsWork.push(n);
  }

  // Bounded-concurrency fan-out.
  const results: Array<{ noteId: string; ok: boolean; error?: string }> = [];
  let cursor = 0;
  const userId = user.id;
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= needsWork.length) return;
      const note = needsWork[idx];
      const r = await summarizeOne(note, backend);
      if (r.ok && r.cache) {
        const { error: writeErr } = await supabase
          .from("notes")
          .update({ cache: r.cache })
          .eq("id", note.id)
          .eq("user_id", userId);
        if (writeErr) {
          results.push({ noteId: note.id, ok: false, error: writeErr.message });
          stats.failed += 1;
        } else {
          results.push({ noteId: note.id, ok: true });
          stats.processed += 1;
        }
      } else if (r.ok) {
        results.push({ noteId: note.id, ok: true });
        stats.skipped += 1;
      } else {
        results.push({ noteId: note.id, ok: false, error: r.error });
        stats.failed += 1;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, needsWork.length) }, worker),
  );

  return NextResponse.json({ ok: true, backend, stats, results });
}
