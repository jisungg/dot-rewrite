"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type Tier = "free" | "plus";
export type SubStatus = "active" | "past_due" | "canceled" | "paused";

export type TierState = {
  tier: Tier;
  status: SubStatus;
  currentPeriodEnd: string | null;
  loading: boolean;
  isPlus: boolean;
  /** True when tier is plus but the latest invoice failed — show a banner. */
  isPastDue: boolean;
};

// Client-side mirror of resolveTier(). Reads the user's subscriptions row
// (RLS-scoped to themselves) and downgrades to 'free' if status isn't
// 'active' or current_period_end has passed.
export function useTier(): TierState {
  const [state, setState] = useState<{
    tier: Tier;
    status: SubStatus;
    currentPeriodEnd: string | null;
  }>({ tier: "free", status: "active", currentPeriodEnd: null });
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end")
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setState({ tier: "free", status: "active", currentPeriodEnd: null });
        setLoading(false);
        return;
      }
      const status = (data["status"] as SubStatus) ?? "active";
      const periodEnd = (data["current_period_end"] as string | null) ?? null;
      const notExpired =
        !periodEnd || new Date(periodEnd).getTime() > Date.now();
      // past_due still grants Plus access — give them a window to fix
      // their card before we cut off features.
      const grantsPlus = status === "active" || status === "past_due";
      const resolved: Tier =
        data["tier"] === "plus" && grantsPlus && notExpired ? "plus" : "free";
      setState({ tier: resolved, status, currentPeriodEnd: periodEnd });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return {
    tier: state.tier,
    status: state.status,
    currentPeriodEnd: state.currentPeriodEnd,
    loading,
    isPlus: state.tier === "plus",
    isPastDue: state.tier === "plus" && state.status === "past_due",
  };
}
