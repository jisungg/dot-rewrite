import "server-only";
// In-memory token-bucket rate limiter, scoped per (user, kind).
//
// Trade-offs: this lives in process memory, so it does NOT survive
// restarts and does NOT span instances. For a single-server deploy or
// dev that's fine; in a multi-instance deploy you'd back this with
// Redis. The shape is the same — swap the storage backend later.

import { HttpError } from "@/lib/api/validate";

type BucketCfg = { capacity: number; refillPerSec: number };

const WINDOWS: Record<string, BucketCfg> = {
  // Most LLM endpoints — generous enough for normal use, tight enough
  // that a runaway loop on the client can't hammer Anthropic.
  llm_default: { capacity: 30, refillPerSec: 30 / 60 },          // 30 / minute
  // Heavier per-call (multiple Claude calls in one request) — be stricter.
  llm_heavy: { capacity: 8, refillPerSec: 8 / 60 },              // 8 / minute
  // Exam start triggers a multi-question generation pass — rare action.
  exam_start: { capacity: 5, refillPerSec: 5 / 600 },            // 5 / 10 minutes
  // Engine spawn (analyze_space.py).
  engine_run: { capacity: 6, refillPerSec: 6 / 300 },            // 6 / 5 minutes
  // Per-note summaries can be requested in bursts when a tab opens.
  llm_burst: { capacity: 60, refillPerSec: 60 / 60 },            // 60 / minute
};

export type RateLimitKind = keyof typeof WINDOWS;

const buckets = new Map<string, { tokens: number; lastRefill: number }>();

export function rateLimit(
  userId: string,
  kind: RateLimitKind,
): { ok: boolean; retryAfter: number } {
  const cfg = WINDOWS[kind];
  if (!cfg) return { ok: true, retryAfter: 0 };
  const key = `${kind}:${userId}`;
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing) {
    buckets.set(key, { tokens: cfg.capacity - 1, lastRefill: now });
    return { ok: true, retryAfter: 0 };
  }
  const elapsedSec = (now - existing.lastRefill) / 1000;
  existing.tokens = Math.min(
    cfg.capacity,
    existing.tokens + elapsedSec * cfg.refillPerSec,
  );
  existing.lastRefill = now;
  if (existing.tokens >= 1) {
    existing.tokens -= 1;
    return { ok: true, retryAfter: 0 };
  }
  const retryAfter = Math.ceil((1 - existing.tokens) / cfg.refillPerSec);
  return { ok: false, retryAfter };
}

/** Throws a 429 HttpError if the user has exceeded the configured rate. */
export function enforceRateLimit(userId: string, kind: RateLimitKind): void {
  const r = rateLimit(userId, kind);
  if (!r.ok) {
    throw new HttpError(
      429,
      "rate_limited",
      `Try again in ${r.retryAfter}s.`,
    );
  }
}

/** Periodically prune buckets that haven't been touched in a while so a
 * long-running process doesn't accumulate unbounded entries. */
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60_000;
const STALE_AFTER_MS = 60 * 60_000;
export function maybeSweep(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (now - v.lastRefill > STALE_AFTER_MS) buckets.delete(k);
  }
}
