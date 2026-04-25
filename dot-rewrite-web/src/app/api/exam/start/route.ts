import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { createClient } from "@/utils/supabase/server";
import type { ExamQuestion, Note } from "@/data/types";
import { completeJson } from "@/lib/llm-backend";
import { GROUNDING_RULES } from "@/lib/llm-grounding";
import { rateLimit, maybeSweep } from "@/lib/api/rate-limit";

// Generate an exam pack from a chosen subset of notes in a space, then
// persist a session row that the UI uses for the timer + answer storage.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NOTES = 20;
const MAX_NOTE_CHARS = 2400;
const ALLOWED_DURATIONS = new Set([300, 600, 900, 1800, 3600]); // 5/10/15/30/60 min

const SYSTEM_PROMPT = `${GROUNDING_RULES}

You are a strict but fair professor writing a closed-book exam over a student's own study notes. The exam tests deep understanding, not memorization.

You will receive:
- A list of notes the student has written. Each note has an id, title, tags, and content.

Generate exam questions a tough teacher would ask:
- Multi-step reasoning, derivations, applied problems, "explain why X implies Y", short proofs, contrast questions, identify-the-mistake, etc.
- Each question must be answerable using ONLY content present in the supplied notes. If you would need to invoke a definition or theorem the notes don't introduce, do not write that question.
- Mix difficulty levels. Use difficulty="challenge" for the hardest 1-2 questions, "hard" for most, "medium" only if you must.
- Assign points: 5 for medium, 10 for hard, 15 for challenge.
- For each question, list the source_note_ids it draws on (the [id] values from the supplied notes). Most questions reference 1-2 notes; synthesis questions can list 2-3.
- Write a private "reference" — 3-4 sentences capturing exactly what a strong answer must establish. The reference is the rubric used to grade the student; it is NEVER shown to them.
- Prompts are markdown with $...$ math allowed. Be terse and exam-formal: "Prove that…", "Derive…", "Given X, find Y", "Explain why…".

Hard rules:
- Output JSON only, no preamble.
- Total of (numQuestions) questions, exactly the number requested.
- Never include outside facts/theorems. The reference must be derivable from the supplied notes word-for-word.
- If the supplied notes don't contain enough material for the requested question count, return as many as you can — do NOT pad with shallow questions or invented content.`;

const QUESTION_SCHEMA = {
  type: "object" as const,
  properties: {
    questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          prompt: { type: "string" as const },
          reference: { type: "string" as const },
          source_note_ids: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          points: { type: "integer" as const },
          difficulty: {
            type: "string" as const,
            enum: ["medium", "hard", "challenge"],
          },
        },
        required: [
          "prompt",
          "reference",
          "source_note_ids",
          "points",
          "difficulty",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

type NoteRow = Pick<
  Note,
  "id" | "title" | "content" | "tags"
>;

export async function POST(req: Request) {
  let body: {
    spaceId?: string;
    noteIds?: string[];
    questionCount?: number;
    durationSeconds?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const spaceId = body.spaceId;
  const requestedCount = Math.min(15, Math.max(3, body.questionCount ?? 6));
  const duration = body.durationSeconds ?? 1800;
  if (!spaceId) {
    return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  }
  if (!ALLOWED_DURATIONS.has(duration)) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
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
  const rl = rateLimit(user.id, "exam_start");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", detail: `Try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } },
    );
  }

  // Confirm the space belongs to the user.
  const { data: space, error: spaceErr } = await supabase
    .from("spaces")
    .select("id")
    .eq("id", spaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (spaceErr || !space) {
    return NextResponse.json({ error: "space_not_found" }, { status: 404 });
  }

  // Pull notes — caller-specified subset, falling back to all unarchived
  // notes in the space.
  let noteQuery = supabase
    .from("notes")
    .select("id, title, content, tags")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .eq("archived", false);
  if (body.noteIds && body.noteIds.length > 0) {
    noteQuery = noteQuery.in("id", body.noteIds);
  }
  const { data: noteRows } = await noteQuery;
  const allNotes = (noteRows ?? []) as NoteRow[];
  if (allNotes.length === 0) {
    return NextResponse.json(
      { error: "no_notes_in_scope" },
      { status: 400 },
    );
  }
  const notes = allNotes.slice(0, MAX_NOTES);

  const userPayload = JSON.stringify({
    num_questions: requestedCount,
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      tags: n.tags ?? [],
      content: (n.content ?? "").slice(0, MAX_NOTE_CHARS),
    })),
  });

  const result = await completeJson<{
    questions: Array<{
      prompt: string;
      reference: string;
      source_note_ids: string[];
      points: number;
      difficulty: "medium" | "hard" | "challenge";
    }>;
  }>({
    task: "exam_questions",
    system: SYSTEM_PROMPT,
    user: userPayload,
    schema: QUESTION_SCHEMA,
    maxTokens: 3000,
    anthropicDefaultModel: "claude-haiku-4-5",
    ollamaDefaultModel: "qwen2.5:7b-instruct",
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: "llm_call_failed", detail: result.error },
      { status: 500 },
    );
  }

  const ownNoteIds = new Set(allNotes.map((n) => n.id));
  const questions: ExamQuestion[] = (result.data.questions ?? [])
    .filter(
      (q) =>
        typeof q.prompt === "string" &&
        q.prompt.trim().length > 0 &&
        typeof q.reference === "string" &&
        q.reference.trim().length > 0,
    )
    .map((q) => ({
      id: randomUUID(),
      prompt: q.prompt.trim(),
      reference: q.reference.trim(),
      source_note_ids: Array.isArray(q.source_note_ids)
        ? q.source_note_ids.filter((id) => ownNoteIds.has(id))
        : [],
      points: Math.max(1, Math.min(20, Math.round(q.points || 10))),
      difficulty: q.difficulty,
    }));

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "no_questions_generated" },
      { status: 500 },
    );
  }

  // Persist the session.
  const { data: session, error: insertErr } = await supabase
    .from("exam_sessions")
    .insert({
      user_id: user.id,
      space_id: spaceId,
      scope_note_ids: notes.map((n) => n.id),
      questions,
      answers: {},
      duration_seconds: duration,
      status: "active",
    })
    .select("id, started_at, duration_seconds")
    .single();
  if (insertErr || !session) {
    return NextResponse.json(
      { error: "session_create_failed", detail: insertErr?.message },
      { status: 500 },
    );
  }

  // Strip private rubric before returning.
  const publicQuestions = questions.map(({ reference: _ref, ...rest }) => rest);
  return NextResponse.json({
    session: {
      id: session.id,
      space_id: spaceId,
      questions: publicQuestions,
      duration_seconds: session.duration_seconds,
      started_at: session.started_at,
      status: "active",
    },
  });
}
