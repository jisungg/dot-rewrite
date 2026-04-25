import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import type { Note, NoteCache, UnderstandEvaluation } from "@/data/types";
import { completeJson } from "@/lib/llm-backend";
import { GROUNDING_RULES } from "@/lib/llm-grounding";
import { rateLimit, maybeSweep } from "@/lib/api/rate-limit";

// Evaluate a student's free-form answer against the private reference
// answer stored in notes.cache.understand. Returns score + key-point
// breakdown + supportive feedback.
//
// Token-light: only sends the question prompt, the reference answer
// (already short — 2–3 sentences), and the student's answer. The note
// itself is not re-sent on every check.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ANSWER_CHARS = 3000;

const SYSTEM_PROMPT = `${GROUNDING_RULES}

You are a Socratic study coach evaluating a student's answer to ONE question about their own notes.

You will receive:
- The question
- A private "reference" rubric (the key points a correct answer hits, derived from the note the student wrote)
- The student's answer

The reference is the ONLY source of truth for this evaluation. It was built from the user's own notes. If the student writes something factually true in general but absent from the reference, that is NOT a "hit" — it is irrelevant to whether they understand THIS note. Conversely, if the student paraphrases what the reference says, even using different vocabulary, that IS a hit.

Output JSON with:
- score: a number from 0 to 1. 0 = missed entirely, 0.5 = partial, 0.85+ = covers the reference's key points.
- hits: list of key points the student got right (1-line each). Each hit must correspond to a point present in the reference.
- misses: list of important reference points they missed or got wrong (1-line each).
- feedback: 2-3 sentences. Encouraging, specific, Socratic. If they're essentially correct relative to the reference, affirm and pose a deeper follow-up that is also answerable from the note. If they missed key parts, point toward what their note says without giving the full answer. Never condescend, and NEVER introduce information that isn't in the reference.

Hard rules:
- Be honest. Do not inflate the score to be nice. A scattered or surface answer should score in the 0.3–0.5 range.
- Never credit outside knowledge. The student is being evaluated on whether they understand THEIR note, not the topic in general.
- Do not reveal the reference verbatim in feedback or hits/misses; paraphrase.
- If the student's answer is empty or off-topic, score 0 and ask them to try again.
- Output JSON only.`;

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    score: { type: "number" as const },
    hits: { type: "array" as const, items: { type: "string" as const } },
    misses: { type: "array" as const, items: { type: "string" as const } },
    feedback: { type: "string" as const },
  },
  required: ["score", "hits", "misses", "feedback"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  let body: {
    spaceId?: string;
    noteId?: string;
    questionId?: string;
    answer?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { spaceId, noteId, questionId, answer } = body;
  if (!spaceId || !noteId || !questionId || typeof answer !== "string") {
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
  const rl = rateLimit(user.id, "llm_burst");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", detail: `Try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } },
    );
  }

  const { data: noteRow, error: readErr } = await supabase
    .from("notes")
    .select("id, cache")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { error: "read_failed", detail: readErr.message },
      { status: 500 },
    );
  }
  const note = noteRow as Pick<Note, "id"> & { cache?: NoteCache | null };
  const pack = note?.cache?.understand;
  const question = pack?.questions.find((q) => q.id === questionId);
  if (!pack || !question) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const trimmed = answer.trim().slice(0, MAX_ANSWER_CHARS);
  if (trimmed.length === 0) {
    const evaluation: UnderstandEvaluation = {
      score: 0,
      hits: [],
      misses: ["No answer provided yet."],
      feedback:
        "Take a shot at it — even a partial answer in your own words tells you (and me) what you actually know vs. what to brush up on.",
    };
    return NextResponse.json({ evaluation });
  }

  const userPayload = JSON.stringify({
    question: question.prompt,
    reference: question.reference,
    student_answer: trimmed,
  });

  const result = await completeJson<UnderstandEvaluation>({
    task: "understand_evaluate",
    system: SYSTEM_PROMPT,
    user: userPayload,
    schema: OUTPUT_SCHEMA,
    maxTokens: 600,
    anthropicDefaultModel: "claude-haiku-4-5",
    ollamaDefaultModel: "qwen2.5:7b-instruct",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        evaluation: null,
        error: "llm_call_failed",
        detail: result.error,
      },
      { status: 200 },
    );
  }

  const data = result.data;
  const evaluation: UnderstandEvaluation = {
    score: Math.max(0, Math.min(1, Number(data.score) || 0)),
    hits: Array.isArray(data.hits) ? data.hits.slice(0, 6) : [],
    misses: Array.isArray(data.misses) ? data.misses.slice(0, 6) : [],
    feedback: (data.feedback ?? "").trim(),
  };
  return NextResponse.json({ evaluation });
}
