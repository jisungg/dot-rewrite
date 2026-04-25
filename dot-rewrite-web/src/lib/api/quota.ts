import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { HttpError } from "@/lib/api/validate";
import { resolveTier, type Tier } from "@/lib/api/tier";

// Soft caps: warn at 80% (pass-through with x-quota-warn header), block
// at 100% with HTTP 429 + structured upgrade payload. Plus removes caps
// for every kind below — its limit is `Infinity` so the helper never
// trips.
//
// Quota state lives in `usage_counters` and is mutated atomically via the
// `quota_increment` RPC. A "day" bucket truncates to UTC date; "week"
// buckets to UTC week start. Both are server-side so client clock skew
// can't cheat.

export type QuotaKind =
  | "dot.chat"
  | "letters.chat"
  | "understand"
  | "exam.start"
  | "summarize"
  | "analyze.manual";

export type QuotaWindow = "day" | "week";

type QuotaCfg = { limit: number; window: QuotaWindow };

export const FREE_LIMITS: Record<QuotaKind, QuotaCfg> = {
  "dot.chat":       { limit: 20, window: "day" },
  "letters.chat":   { limit: 15, window: "day" },
  "understand":     { limit: 3,  window: "day" },
  "exam.start":     { limit: 1,  window: "week" },
  "summarize":      { limit: 10, window: "day" },
  "analyze.manual": { limit: 5,  window: "day" },
};

export type QuotaResult = {
  allowed: boolean;          // false → request must be blocked
  used: number;              // count after the would-be increment
  limit: number;             // Infinity for plus
  window: QuotaWindow;
  warn: boolean;             // true at >=80% utilization, false otherwise
  tier: Tier;
};

const PLUS_LIMITS: Record<QuotaKind, QuotaCfg> = Object.fromEntries(
  Object.entries(FREE_LIMITS).map(([k, v]) => [k, { ...v, limit: Number.POSITIVE_INFINITY }]),
) as Record<QuotaKind, QuotaCfg>;

export function limitsFor(tier: Tier): Record<QuotaKind, QuotaCfg> {
  return tier === "plus" ? PLUS_LIMITS : FREE_LIMITS;
}

/**
 * Check + increment the user's quota for `kind` in one round trip.
 * - Plus tier: always allowed, returns warn=false, used=current+1.
 * - Free tier: increments via quota_increment RPC; flags warn at >=80%.
 *   Throws HttpError(429) when the post-increment count exceeds the limit.
 */
export async function enforceQuota(
  supabase: SupabaseClient,
  userId: string,
  kind: QuotaKind,
): Promise<QuotaResult> {
  const tier = await resolveTier(supabase, userId);
  const cfg = limitsFor(tier)[kind];
  const newCount = await incrementCounter(supabase, userId, kind, cfg.window);
  if (!Number.isFinite(cfg.limit)) {
    return {
      allowed: true,
      used: newCount,
      limit: Number.POSITIVE_INFINITY,
      window: cfg.window,
      warn: false,
      tier,
    };
  }
  const warn = newCount >= Math.ceil(cfg.limit * 0.8);
  if (newCount > cfg.limit) {
    throw new HttpError(
      429,
      JSON.stringify({
        error: "quota_exceeded",
        kind,
        limit: cfg.limit,
        used: newCount,
        window: cfg.window,
        upgrade_to: "plus",
      }),
    );
  }
  return {
    allowed: true,
    used: newCount,
    limit: cfg.limit,
    window: cfg.window,
    warn,
    tier,
  };
}

/**
 * Headers a route can attach to its Response so the client can display
 * the soft-warning toast at >=80%.
 */
export function quotaHeaders(q: QuotaResult): Record<string, string> {
  return {
    "x-quota-tier": q.tier,
    "x-quota-kind": "",   // filled in by caller if useful
    "x-quota-used": String(q.used),
    "x-quota-limit": Number.isFinite(q.limit) ? String(q.limit) : "unlimited",
    "x-quota-window": q.window,
    "x-quota-warn": q.warn ? "1" : "0",
  };
}

async function incrementCounter(
  supabase: SupabaseClient,
  userId: string,
  kind: QuotaKind,
  window: QuotaWindow,
): Promise<number> {
  const { data, error } = await supabase.rpc("quota_increment", {
    p_user_id: userId,
    p_kind: kind,
    p_window: window,
  });
  if (error) {
    console.error("quota_increment failed:", error.message);
    // Fail-open: a quota RPC outage shouldn't block the user. Caller
    // still gets a sane QuotaResult with used=0 → no warn, no block.
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
