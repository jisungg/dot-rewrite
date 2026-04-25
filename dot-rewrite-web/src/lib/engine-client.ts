import { handleQuotaResponse } from "@/lib/quota-toast";

export type EngineStartResponse = {
  ok: boolean;
  started?: string[];
  already_running?: string[];
  error?: string;
};

export type EngineStatus = {
  space_id: string;
  status:
    | "none"
    | "running"
    | "ok"
    | "failed"
    | "not_owner"
    | string;
  started_at?: string;
  finished_at?: string | null;
  notes?: string | null;
};

export type EngineStatusResponse = {
  allDone: boolean;
  statuses: EngineStatus[];
};

export async function startEngineForSpaces(
  spaceIds: string[],
): Promise<EngineStartResponse> {
  if (spaceIds.length === 0) return { ok: true, started: [] };
  const res = await fetch("/api/analyze-space", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ spaceIds }),
  });
  handleQuotaResponse(res, "Engine analysis");
  return (await res.json()) as EngineStartResponse;
}

export async function getEngineStatus(
  spaceIds: string[],
): Promise<EngineStatusResponse> {
  const qs = encodeURIComponent(spaceIds.join(","));
  const res = await fetch(`/api/analyze-space?spaceIds=${qs}`, {
    method: "GET",
    cache: "no-store",
  });
  return (await res.json()) as EngineStatusResponse;
}

export async function waitForEngine(
  spaceIds: string[],
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<EngineStatusResponse> {
  const interval = opts.intervalMs ?? 1500;
  const timeout = opts.timeoutMs ?? 5 * 60_000;
  const deadline = Date.now() + timeout;
  let last: EngineStatusResponse = { allDone: false, statuses: [] };
  while (Date.now() < deadline) {
    last = await getEngineStatus(spaceIds);
    if (last.allDone) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  return last;
}

export async function runEngineForSpaces(
  spaceIds: string[],
): Promise<{ started: EngineStartResponse; final: EngineStatusResponse }> {
  const started = await startEngineForSpaces(spaceIds);
  const final = await waitForEngine(spaceIds);
  return { started, final };
}
