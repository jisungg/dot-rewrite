import { NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { createClient } from "@/utils/supabase/server";
import type { Note, NoteCache, Space, SpaceSummaryCache } from "@/data/types";
import { backendName, completeJson } from "@/lib/llm-backend";
import { GROUNDING_RULES } from "@/lib/llm-grounding";
import { rateLimit, maybeSweep } from "@/lib/api/rate-limit";

// Per-space TL;DR. One or two concrete sentences describing what lives in
// the space, reusing already-computed per-note summaries when present so
// this endpoint stays cheap.
//
// Cache: `spaces.summary_cache` jsonb column, keyed by a content hash
// derived from each note's (id, last_modified_at) plus any per-note
// summary currently stored in `notes.cache`. The hash changes whenever
// any member note is edited — if the user just re-opens the tab with no
// note edits, we serve from the DB with zero API calls.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTES_FOR_PROMPT = 60;
const MAX_EXCERPT_CHARS = 240;

const SYSTEM_PROMPT = `${GROUNDING_RULES}

You write a one-to-two sentence TL;DR for a collection of study notes in a single subject-matter "space".

Rules:
- Exactly 1 or 2 sentences. No bullet points, no markdown, no preamble ("This space…" / "The notes cover…" / "In summary…").
- Concrete and specific: name the actual topics, concepts, or themes that show up across the notes you were given. Use the user's own terminology where they used it; do not substitute fancier or more textbook-style names that the notes themselves did not use.
- Do not invent topics that are not supported by the titles or summaries you were given. Do not extrapolate from what the space "probably" contains.
- If the input is empty or too vague, return an empty string.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: { type: "string" as const },
  },
  required: ["summary"],
  additionalProperties: false,
};

function stripMd(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)\s]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)\s]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type NoteRow = Pick<Note, "id" | "title" | "content" | "tags" | "last_modified_at"> & {
  cache?: NoteCache | null;
};

function hashPayload(
  spaceId: string,
  notes: NoteRow[],
  backend: string,
): string {
  const h = createHash("sha1");
  h.update(`summary-space:${backend}\0${spaceId}\0`);
  const sorted = [...notes].sort((a, b) => a.id.localeCompare(b.id));
  for (const n of sorted) {
    h.update(n.id);
    h.update("\0");
    h.update(n.last_modified_at ?? "");
    h.update("\0");
    h.update(n.cache?.content_hash ?? "");
    h.update("\0");
  }
  return h.digest("hex");
}

function buildPayload(space: Pick<Space, "name">, notes: NoteRow[]): string {
  const tagCounts: Record<string, number> = {};
  for (const n of notes) {
    for (const t of n.tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t]) => t);

  const items = notes.slice(0, MAX_NOTES_FOR_PROMPT).map((n) => {
    const cachedSummary = n.cache?.summary;
    const excerpt =
      cachedSummary && cachedSummary.length > 0
        ? cachedSummary
        : stripMd(n.content ?? "").slice(0, MAX_EXCERPT_CHARS);
    return {
      title: n.title || "Untitled",
      tags: (n.tags ?? []).slice(0, 4),
      excerpt,
    };
  });

  return JSON.stringify({
    space_name: space.name,
    note_count: notes.length,
    top_tags: topTags,
    notes: items,
  });
}

export async function POST(req: Request) {
  let body: { spaceId?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const spaceId = body.spaceId;
  if (!spaceId) {
    return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  maybeSweep();
  const rl = rateLimit(user.id, "llm_default");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", detail: `Try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } },
    );
  }

  // Read core space fields first. We intentionally do NOT include
  // `summary_cache` here — if the migration that adds that column hasn't
  // been applied yet, the whole select would fail. Fetch the cache in a
  // tolerant second query below.
  const { data: spaceRow, error: spaceErr } = await supabase
    .from("spaces")
    .select("id, name")
    .eq("id", spaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (spaceErr) {
    console.error("summarize-space: space read failed:", spaceErr);
    return NextResponse.json(
      { error: "read_failed", detail: spaceErr.message },
      { status: 500 },
    );
  }
  if (!spaceRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const space = spaceRow as Pick<Space, "id" | "name">;

  // Best-effort read of summary_cache; ignore errors so an un-migrated DB
  // still produces a (fresh, uncached) summary instead of 500ing.
  let cached: SpaceSummaryCache | null = null;
  try {
    const { data: cacheRow, error: cacheErr } = await supabase
      .from("spaces")
      .select("summary_cache")
      .eq("id", spaceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (cacheErr) {
      console.warn(
        "summarize-space: summary_cache column unavailable (run migration 20260424010000_spaces_summary_cache.sql):",
        cacheErr.message,
      );
    } else if (cacheRow && "summary_cache" in cacheRow) {
      cached =
        (cacheRow as { summary_cache?: SpaceSummaryCache | null })
          .summary_cache ?? null;
    }
  } catch (err) {
    console.warn("summarize-space: summary_cache read threw:", err);
  }

  const { data: notesData, error: notesErr } = await supabase
    .from("notes")
    .select("id, title, content, tags, last_modified_at, cache")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .eq("archived", false)
    .order("last_modified_at", { ascending: false });
  if (notesErr) {
    return NextResponse.json({ error: "notes_read_failed" }, { status: 500 });
  }
  const notes = (notesData ?? []) as NoteRow[];

  if (notes.length === 0) {
    return NextResponse.json({ cached: false, summary: "", updated_at: null });
  }

  const backend = backendName();
  const hash = hashPayload(spaceId, notes, backend);

  if (
    !body.force &&
    cached?.content_hash === hash &&
    typeof cached.summary === "string"
  ) {
    return NextResponse.json({
      cached: true,
      summary: cached.summary,
      updated_at: cached.updated_at ?? null,
    });
  }

  const userMessage = buildPayload(space, notes);
  const result = await completeJson<{ summary: string }>({
    task: "space_summarizer",
    system: SYSTEM_PROMPT,
    user: userMessage,
    schema: OUTPUT_SCHEMA,
    maxTokens: 220,
    anthropicDefaultModel: "claude-haiku-4-5",
    ollamaDefaultModel: "qwen2.5:7b-instruct",
  });

  if (!result.ok) {
    console.error("summarize-space: LLM call failed:", result.error);
    return NextResponse.json({
      cached: false,
      fallback: true,
      summary: "",
      error: "llm_call_failed",
      detail: result.error,
    });
  }

  const summary = (result.data.summary ?? "").trim();
  const nextCache: SpaceSummaryCache = {
    summary,
    content_hash: hash,
    updated_at: new Date().toISOString(),
  };

  // Best-effort cache write. If the column doesn't exist yet (migration
  // not applied), log and continue — the client still gets the fresh
  // summary, just without DB persistence this run.
  try {
    const { error: writeErr } = await supabase
      .from("spaces")
      .update({ summary_cache: nextCache })
      .eq("id", spaceId)
      .eq("user_id", user.id);
    if (writeErr) {
      console.warn(
        "summarize-space: cache write skipped (run migration 20260424010000_spaces_summary_cache.sql):",
        writeErr.message,
      );
    }
  } catch (err) {
    console.warn("summarize-space: cache write threw:", err);
  }

  return NextResponse.json({
    cached: false,
    summary,
    updated_at: nextCache.updated_at,
    backend,
    model: result.model,
  });
}
