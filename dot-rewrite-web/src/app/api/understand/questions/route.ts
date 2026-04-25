import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@/utils/supabase/server";
import type {
  Note,
  NoteCache,
  SemanticClusterRow,
  UnderstandPack,
  UnderstandQuestion,
} from "@/data/types";
import { backendName, completeJson } from "@/lib/llm-backend";
import { GROUNDING_RULES } from "@/lib/llm-grounding";
import { rateLimit, maybeSweep } from "@/lib/api/rate-limit";
import { enforceQuota, quotaHeaders } from "@/lib/api/quota";
import { HttpError } from "@/lib/api/validate";

// Generate (or return cached) "Understand" question pack for one note.
//
// We send the focused note's full text (capped) plus 1-2 sentence
// summaries of its semantic-cluster siblings, so the model can ask real
// connect-the-dots questions without us shipping every note in the space.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTE_CHARS = 5000;
const MAX_RELATED = 4;
const MAX_RELATED_SUMMARY_CHARS = 240;

const SYSTEM_PROMPT = `${GROUNDING_RULES}

You are a study coach helping a student verify they truly understand ONE note from their study space. Every question, hint, and reference answer you write must be answerable purely from the supplied note (and, for the connect question, the supplied related-note summaries). You are not adding curriculum from outside the user's notes.

You will receive the note's title and content, plus 1–2 sentence summaries of related notes from the same topic cluster.

Generate exactly 4 questions designed to probe real understanding (not memorization). Use these four kinds, one each, in this order:

1. kind="explain" — Ask the student to restate the core idea, definition, or proof in their own words, using ONLY what the note says. If the note contains a proof, ask them to walk through it intuitively (and the reference answer must be derivable from that proof — do not introduce alternative proofs the note doesn't show).
2. kind="apply" — Pose a short problem that uses the concept exactly as the note presents it. The reference answer must be solvable with just the note's content; do NOT pull in outside techniques, theorems, or formulas. If the note doesn't give enough machinery for an applied problem, make this question simpler (e.g. "redo the worked example with these specific numbers from the note").
3. kind="connect" — Ask the student to relate this note to ONE of the supplied "related notes" using ONLY what is in BOTH summaries. Pick a real, non-trivial connection that is visible in the supplied text (a dependency, contrast, or shared technique that both notes mention). Set related_note_ids to the [note_id] of that related note. If no related notes were given, or none share visible content, return an empty related_note_ids and ask "what concept inside this note depends on or generalizes another concept inside this note".
4. kind="example" — Ask the student to invent their own example or use case to show they internalized the concept. Make the prompt explicit that the example must use the concept as defined in this note (not external definitions). The reference answer should describe what makes a valid student example based on the note's definition.

For each question include:
- prompt: 1–2 short sentences. Plain prose, no markdown headers. Use $...$ for any formula. Be intuitive — a curious tutor, not a textbook.
- hint: one short sentence the student can reveal if stuck. Optional but recommended.
- reference: 2–3 sentences capturing the key points a correct answer should hit. Private — never shown to the student. This is the rubric used to evaluate their answer later.
- related_note_ids: array of note_ids (uuids), only set for the connect question, and only if you genuinely picked one from the supplied related notes.

Hard rules:
- Ground every question and reference in the supplied note. Do not invent definitions, theorems, or facts not present.
- If the note is empty, trivial, or unintelligible, return an empty questions array.
- Output JSON only.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          kind: {
            type: "string" as const,
            enum: ["explain", "apply", "connect", "example"],
          },
          prompt: { type: "string" as const },
          hint: { type: "string" as const },
          reference: { type: "string" as const },
          related_note_ids: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
        required: ["kind", "prompt", "reference"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

type NoteRow = Pick<
  Note,
  "id" | "title" | "content" | "tags" | "last_modified_at"
> & {
  cache?: NoteCache | null;
};

function packHash(
  note: Pick<Note, "id" | "title" | "content">,
  relatedIds: string[],
  backend: string,
): string {
  const h = createHash("sha1");
  h.update(`understand:${backend}\0`);
  h.update(note.id);
  h.update("\0");
  h.update(note.title ?? "");
  h.update("\0");
  h.update(note.content ?? "");
  h.update("\0");
  for (const id of [...relatedIds].sort()) {
    h.update(id);
    h.update("|");
  }
  return h.digest("hex");
}

function pickRelatedNotes(
  focused: NoteRow,
  notes: NoteRow[],
  clusters: SemanticClusterRow[],
): NoteRow[] {
  const cluster = clusters.find((c) =>
    (c.note_ids ?? []).includes(focused.id),
  );
  const candidateIds = new Set<string>(cluster?.note_ids ?? []);
  candidateIds.delete(focused.id);
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const ordered: NoteRow[] = [];
  for (const id of candidateIds) {
    const n = noteById.get(id);
    if (n) ordered.push(n);
  }
  ordered.sort((a, b) =>
    (b.last_modified_at ?? "").localeCompare(a.last_modified_at ?? ""),
  );
  return ordered.slice(0, MAX_RELATED);
}

function summarize(note: NoteRow): string {
  const cached = note.cache?.summary;
  if (cached && cached.length > 0) return cached;
  const text = (note.content ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, MAX_RELATED_SUMMARY_CHARS);
}

export async function POST(req: Request) {
  let body: { spaceId?: string; noteId?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const spaceId = body.spaceId;
  const noteId = body.noteId;
  if (!spaceId || !noteId) {
    return NextResponse.json({ error: "missing_args" }, { status: 400 });
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
  let quota;
  try {
    quota = await enforceQuota(supabase, user.id, "understand");
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) {
      return new NextResponse(err.message, {
        status: 429,
        headers: { "content-type": "application/json" },
      });
    }
    throw err;
  }

  // Load focused note (with cache).
  const { data: noteRow, error: noteErr } = await supabase
    .from("notes")
    .select("id, title, content, tags, last_modified_at, cache")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (noteErr) {
    return NextResponse.json(
      { error: "read_failed", detail: noteErr.message },
      { status: 500 },
    );
  }
  if (!noteRow) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const focused = noteRow as NoteRow;

  // Load space's other notes + clusters for "connect" questions.
  const [{ data: otherRows }, { data: clusterRows }] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content, tags, last_modified_at, cache")
      .eq("user_id", user.id)
      .eq("space_id", spaceId)
      .eq("archived", false)
      .neq("id", noteId),
    supabase
      .from("semantic_topic_clusters")
      .select("id, space_id, note_ids, label, parent_topic")
      .eq("space_id", spaceId),
  ]);
  const others = (otherRows ?? []) as NoteRow[];
  const clusters = (clusterRows ?? []) as SemanticClusterRow[];

  const related = pickRelatedNotes(focused, others, clusters);
  const relatedIds = related.map((n) => n.id);

  const backend = backendName();
  const hash = packHash(focused, relatedIds, backend);
  const cached = focused.cache?.understand ?? null;
  if (
    !body.force &&
    cached?.content_hash === hash &&
    Array.isArray(cached.questions) &&
    cached.questions.length > 0
  ) {
    return NextResponse.json({
      cached: true,
      pack: cached,
    });
  }

  // Build the user payload.
  const noteText = (focused.content ?? "").slice(0, MAX_NOTE_CHARS);
  const userPayload = JSON.stringify({
    note: {
      id: focused.id,
      title: focused.title,
      tags: focused.tags ?? [],
      content: noteText,
    },
    related_notes: related.map((n) => ({
      id: n.id,
      title: n.title,
      summary: summarize(n),
    })),
  });

  const result = await completeJson<{
    questions: Array<{
      kind: string;
      prompt: string;
      hint?: string;
      reference: string;
      related_note_ids?: string[];
    }>;
  }>({
    task: "understand_questions",
    system: SYSTEM_PROMPT,
    user: userPayload,
    schema: OUTPUT_SCHEMA,
    maxTokens: 1400,
    anthropicDefaultModel: "claude-haiku-4-5",
    ollamaDefaultModel: "qwen2.5:7b-instruct",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        cached: false,
        fallback: true,
        error: "llm_call_failed",
        detail: result.error,
      },
      { status: 200 },
    );
  }

  const questions: UnderstandQuestion[] = (result.data.questions ?? [])
    .filter((q) =>
      ["explain", "apply", "connect", "example"].includes(q.kind ?? ""),
    )
    .map((q) => ({
      id: randomUUID(),
      kind: q.kind as UnderstandQuestion["kind"],
      prompt: (q.prompt ?? "").trim(),
      hint: q.hint?.trim() || null,
      reference: (q.reference ?? "").trim(),
      related_note_ids: Array.isArray(q.related_note_ids)
        ? q.related_note_ids.filter((id) => relatedIds.includes(id))
        : [],
    }))
    .filter((q) => q.prompt.length > 0 && q.reference.length > 0);

  const pack: UnderstandPack = {
    questions,
    content_hash: hash,
    related_note_ids: relatedIds,
    updated_at: new Date().toISOString(),
  };

  const nextCache: NoteCache = {
    ...(focused.cache ?? {}),
    understand: pack,
  };
  const { error: writeErr } = await supabase
    .from("notes")
    .update({ cache: nextCache })
    .eq("id", focused.id)
    .eq("user_id", user.id);
  if (writeErr) {
    console.warn("understand.questions: cache write failed:", writeErr.message);
  }

  return NextResponse.json(
    { cached: false, pack },
    { headers: quotaHeaders(quota) },
  );
}
