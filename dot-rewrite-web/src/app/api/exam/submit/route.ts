import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import type {
  ExamEvaluation,
  ExamPerQuestionResult,
  ExamQuestion,
} from "@/data/types";
import { completeJson } from "@/lib/llm-backend";
import { GROUNDING_RULES } from "@/lib/llm-grounding";
import { rateLimit, maybeSweep } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ANSWER_CHARS = 4000;
const CONCURRENCY = 4;

const PER_Q_SYSTEM_PROMPT = `${GROUNDING_RULES}

You are a strict but fair professor grading ONE answer on a closed-book exam over the student's own notes.

You receive:
- The question
- A private "reference" — the rubric derived from the student's notes. This is the ONLY source of truth for grading. Do not credit external knowledge.
- The student's answer

Output JSON with:
- score: number from 0 to 1. 0 = nothing right, 0.5 = partial, 0.85+ = essentially complete.
- hits: 1-line bullets, each describing a key reference point the student covered.
- misses: 1-line bullets, each describing a reference point the student missed or got wrong.
- feedback: 1-2 sentences. Specific, exam-grader tone. Not chatty.

Rules:
- Be honest, not generous. If the answer is shallow, mark it 0.3-0.5.
- Hits/misses must correspond to points in the reference; do NOT credit correct-but-irrelevant facts.
- Feedback must not introduce information that isn't in the reference.
- If the student's answer is empty or off-topic, score 0 with feedback "No answer provided." (or equivalent).`;

const PER_Q_SCHEMA = {
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

const OVERALL_SYSTEM_PROMPT = `${GROUNDING_RULES}

You are a strict but fair professor giving a final wrap-up on a student's exam over their own notes.

You receive: the per-question rubric scores + your own per-question feedback. Output a 2-3 sentence overall summary in exam-grader tone. Mention strongest area + the area most needing review (use note titles or topics that appear in the rubric data; do not invent topics). No preamble.`;

const OVERALL_SCHEMA = {
  type: "object" as const,
  properties: { overall: { type: "string" as const } },
  required: ["overall"],
  additionalProperties: false,
};

type SessionRow = {
  id: string;
  user_id: string;
  space_id: string;
  questions: ExamQuestion[];
  status: string;
  duration_seconds: number;
  started_at: string;
};

async function gradeOne(
  q: ExamQuestion,
  answer: string,
): Promise<ExamPerQuestionResult> {
  const trimmed = answer.trim().slice(0, MAX_ANSWER_CHARS);
  if (trimmed.length === 0) {
    return {
      question_id: q.id,
      score: 0,
      points_earned: 0,
      hits: [],
      misses: ["No answer provided."],
      feedback: "No answer provided.",
    };
  }
  const result = await completeJson<{
    score: number;
    hits: string[];
    misses: string[];
    feedback: string;
  }>({
    task: "exam_grade",
    system: PER_Q_SYSTEM_PROMPT,
    user: JSON.stringify({
      question: q.prompt,
      reference: q.reference,
      student_answer: trimmed,
    }),
    schema: PER_Q_SCHEMA,
    maxTokens: 500,
  });
  if (!result.ok) {
    return {
      question_id: q.id,
      score: 0,
      points_earned: 0,
      hits: [],
      misses: ["Grader unavailable."],
      feedback:
        "The grader could not be reached for this question. Treat as ungraded.",
    };
  }
  const score = Math.max(0, Math.min(1, Number(result.data.score) || 0));
  return {
    question_id: q.id,
    score,
    points_earned: Math.round(score * q.points * 10) / 10,
    hits: Array.isArray(result.data.hits) ? result.data.hits.slice(0, 6) : [],
    misses: Array.isArray(result.data.misses)
      ? result.data.misses.slice(0, 6)
      : [],
    feedback: (result.data.feedback ?? "").trim(),
  };
}

async function gradeAll(
  questions: ExamQuestion[],
  answers: Record<string, string>,
): Promise<ExamPerQuestionResult[]> {
  const results: ExamPerQuestionResult[] = new Array(questions.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const idx = cursor++;
      if (idx >= questions.length) return;
      results[idx] = await gradeOne(questions[idx], answers[questions[idx].id] ?? "");
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, questions.length) }, worker),
  );
  return results;
}

export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    answers?: Record<string, string>;
    autoSubmitted?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.sessionId || !body.answers) {
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
  const rl = rateLimit(user.id, "llm_heavy");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", detail: `Try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } },
    );
  }

  const { data: row, error: readErr } = await supabase
    .from("exam_sessions")
    .select(
      "id, user_id, space_id, questions, status, duration_seconds, started_at",
    )
    .eq("id", body.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { error: "read_failed", detail: readErr.message },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const session = row as SessionRow;
  if (session.status !== "active") {
    return NextResponse.json(
      { error: "already_submitted" },
      { status: 409 },
    );
  }

  // Save answers immediately so the row records the student's effort even
  // if grading fails.
  await supabase
    .from("exam_sessions")
    .update({ answers: body.answers })
    .eq("id", session.id)
    .eq("user_id", user.id);

  const perQuestion = await gradeAll(session.questions, body.answers);
  const totalPoints = session.questions.reduce((s, q) => s + q.points, 0);
  const earnedPoints =
    Math.round(
      perQuestion.reduce((s, r) => s + r.points_earned, 0) * 10,
    ) / 10;

  // Overall feedback rollup.
  const overallResult = await completeJson<{ overall: string }>({
    task: "exam_overall",
    system: OVERALL_SYSTEM_PROMPT,
    user: JSON.stringify({
      total_points: totalPoints,
      earned_points: earnedPoints,
      per_question: perQuestion.map((r) => {
        const q = session.questions.find((q) => q.id === r.question_id);
        return {
          difficulty: q?.difficulty,
          points: q?.points,
          earned: r.points_earned,
          feedback: r.feedback,
        };
      }),
    }),
    schema: OVERALL_SCHEMA,
    maxTokens: 250,
  });

  const overall = overallResult.ok
    ? (overallResult.data.overall ?? "").trim()
    : `You earned ${earnedPoints} of ${totalPoints} points.`;

  const evaluation: ExamEvaluation = {
    per_question: perQuestion,
    total_points: totalPoints,
    earned_points: earnedPoints,
    overall,
  };

  await supabase
    .from("exam_sessions")
    .update({
      evaluation,
      status: "submitted",
      finished_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("user_id", user.id);

  return NextResponse.json({ evaluation });
}
