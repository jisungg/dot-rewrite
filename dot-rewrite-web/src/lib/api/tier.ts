import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Tier = "free" | "plus";

export type SubscriptionRow = {
  user_id: string;
  tier: Tier;
  status: "active" | "past_due" | "canceled" | "paused";
  current_period_end: string | null;
};

export async function resolveTier(
  supabase: SupabaseClient,
  userId: string,
): Promise<Tier> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "free";
  if (data.tier !== "plus") return "free";
  // Only honor 'plus' if status is active and (no period_end OR period_end in the future)
  if (data.status !== "active") return "free";
  if (
    data.current_period_end &&
    new Date(data.current_period_end).getTime() < Date.now()
  ) {
    return "free";
  }
  return "plus";
}

export function isPlus(tier: Tier): tier is "plus" {
  return tier === "plus";
}
