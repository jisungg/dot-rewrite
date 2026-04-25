import type { OutlineHeading } from "@/data/types";

export type NoteSummary = {
  summary: string;
  outline: OutlineHeading[];
  cached: boolean;
  fallback?: boolean;
  updated_at?: string | null;
};

export async function fetchNoteSummary(
  noteId: string,
  opts: { force?: boolean } = {},
): Promise<NoteSummary> {
  const res = await fetch("/api/summarize-note", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ noteId, force: opts.force ?? false }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    const msg = body?.detail
      ? `${body.error ?? "error"}: ${body.detail}`
      : (body?.error ?? `summarize_failed_${res.status}`);
    throw new Error(msg);
  }
  return (await res.json()) as NoteSummary;
}

export type SpaceSummary = {
  summary: string;
  cached: boolean;
  fallback?: boolean;
  detail?: string;
  updated_at?: string | null;
};

export type BatchSummaryResult = {
  ok: boolean;
  stats: { total: number; skipped: number; processed: number; failed: number };
};

export async function summarizeSpaceNotesBatch(
  spaceIds: string[],
): Promise<BatchSummaryResult> {
  if (spaceIds.length === 0) {
    return { ok: true, stats: { total: 0, skipped: 0, processed: 0, failed: 0 } };
  }
  const res = await fetch("/api/summarize-notes-batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spaceIds, onlyStale: true }),
  });
  if (!res.ok) {
    return { ok: false, stats: { total: 0, skipped: 0, processed: 0, failed: 0 } };
  }
  return (await res.json()) as BatchSummaryResult;
}

export async function fetchSpaceSummary(
  spaceId: string,
  opts: { force?: boolean } = {},
): Promise<SpaceSummary> {
  const res = await fetch("/api/summarize-space", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spaceId, force: opts.force ?? false }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string; detail?: string }
      | null;
    const msg = body?.detail
      ? `${body.error ?? "error"}: ${body.detail}`
      : (body?.error ?? `summarize_failed_${res.status}`);
    throw new Error(msg);
  }
  return (await res.json()) as SpaceSummary;
}
