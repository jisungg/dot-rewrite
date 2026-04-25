import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import type { ExamQuestion } from "@/data/types";

// Resume support: returns the user's currently-active exam in this space,
// if any. Strips private rubrics before returning. Used by the Exam UI on
// mount so a hard reload mid-exam restores timer + questions + answers.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId") ?? "";
  if (!UUID_RE.test(spaceId)) {
    return NextResponse.json({ error: "invalid_space_id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("exam_sessions")
    .select(
      "id, space_id, scope_note_ids, questions, answers, duration_seconds, started_at, status",
    )
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { error: "read_failed", detail: error.message },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ session: null });
  }

  // If the timer has already elapsed but the row is still 'active' (the
  // user was offline when their countdown hit zero), treat as expired —
  // the client will submit / abandon as appropriate. We don't auto-flip
  // status here to keep this endpoint side-effect-free.
  const startMs = new Date(data.started_at as string).getTime();
  const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
  const expired =
    Number.isFinite(elapsedSec) &&
    elapsedSec >= (data.duration_seconds as number);

  // Strip private rubrics before sending to the client.
  const rawQuestions = (data.questions as ExamQuestion[] | null) ?? [];
  const publicQuestions = rawQuestions.map(
    ({ reference: _ref, ...rest }) => rest,
  );

  return NextResponse.json({
    session: {
      id: data.id,
      space_id: data.space_id,
      questions: publicQuestions,
      answers: data.answers ?? {},
      duration_seconds: data.duration_seconds,
      started_at: data.started_at,
      status: "active",
      expired,
    },
  });
}
