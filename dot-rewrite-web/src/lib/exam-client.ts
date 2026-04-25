import type { ExamEvaluation, ExamQuestion } from "@/data/types";
import { handleQuotaResponse } from "@/lib/quota-toast";

export type ExamStartResponse = {
  session: {
    id: string;
    space_id: string;
    questions: Array<Omit<ExamQuestion, "reference">>;
    duration_seconds: number;
    started_at: string;
    status: "active";
  };
};

export type ActiveExamResponse = {
  session:
    | {
        id: string;
        space_id: string;
        questions: Array<Omit<ExamQuestion, "reference">>;
        answers: Record<string, string>;
        duration_seconds: number;
        started_at: string;
        status: "active";
        expired: boolean;
      }
    | null;
};

export async function fetchActiveExam(
  spaceId: string,
): Promise<ActiveExamResponse> {
  const res = await fetch(
    `/api/exam/active?spaceId=${encodeURIComponent(spaceId)}`,
    { method: "GET", cache: "no-store" },
  );
  if (!res.ok) return { session: null };
  return (await res.json()) as ActiveExamResponse;
}

export async function startExam(args: {
  spaceId: string;
  noteIds?: string[];
  questionCount: number;
  durationSeconds: number;
}): Promise<ExamStartResponse> {
  const res = await fetch("/api/exam/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  handleQuotaResponse(res, "Exam");
  const body = (await res.json().catch(() => null)) as
    | (ExamStartResponse & { error?: string; detail?: string })
    | null;
  if (!res.ok || !body || !body.session) {
    throw new Error(body?.detail ?? body?.error ?? `failed_${res.status}`);
  }
  return body;
}

export async function submitExam(args: {
  sessionId: string;
  answers: Record<string, string>;
  autoSubmitted?: boolean;
}): Promise<{ evaluation: ExamEvaluation }> {
  const res = await fetch("/api/exam/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = (await res.json().catch(() => null)) as
    | { evaluation: ExamEvaluation; error?: string; detail?: string }
    | null;
  if (!res.ok || !body || !body.evaluation) {
    throw new Error(body?.detail ?? body?.error ?? `failed_${res.status}`);
  }
  return body;
}
