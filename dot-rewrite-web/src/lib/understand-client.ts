import type { UnderstandEvaluation, UnderstandPack } from "@/data/types";
import { handleQuotaResponse } from "@/lib/quota-toast";

export type FetchPackResult = {
  cached: boolean;
  pack: UnderstandPack | null;
  fallback?: boolean;
  error?: string;
  detail?: string;
};

export async function fetchUnderstandPack(args: {
  spaceId: string;
  noteId: string;
  force?: boolean;
}): Promise<FetchPackResult> {
  const res = await fetch("/api/understand/questions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      spaceId: args.spaceId,
      noteId: args.noteId,
      force: args.force ?? false,
    }),
  });
  handleQuotaResponse(res, "Understand");
  const body = (await res.json().catch(() => null)) as
    | { cached?: boolean; pack?: UnderstandPack; fallback?: boolean; error?: string; detail?: string }
    | null;
  if (!res.ok || !body) {
    throw new Error(body?.detail ?? body?.error ?? `failed_${res.status}`);
  }
  return {
    cached: Boolean(body.cached),
    pack: body.pack ?? null,
    fallback: body.fallback,
    error: body.error,
    detail: body.detail,
  };
}

export async function evaluateAnswer(args: {
  spaceId: string;
  noteId: string;
  questionId: string;
  answer: string;
}): Promise<UnderstandEvaluation | null> {
  const res = await fetch("/api/understand/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = (await res.json().catch(() => null)) as
    | { evaluation?: UnderstandEvaluation; error?: string; detail?: string }
    | null;
  if (!res.ok || !body) {
    throw new Error(body?.detail ?? body?.error ?? `failed_${res.status}`);
  }
  return body.evaluation ?? null;
}
