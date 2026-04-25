"use client";

import { toast } from "sonner";

// Read the quota headers from any quota-protected response and surface
// a single, friendly Sonner toast. We never throw raw "cap reached" /
// status-code language at the user — just a calm nudge to upgrade.
//
//   - 429 (block)      → "Upgrade to Plus to keep going" with Upgrade action.
//   - x-quota-warn=1   → soft "Almost out of free Dot for today" nudge.
//
// Returns true when the response was a 429 block; callers can use that
// to bail out of their normal error path so the chat bubble doesn't
// also show a red banner.
export function handleQuotaResponse(res: Response, _label: string): boolean {
  if (res.status === 429) {
    // Dedupe across multiple callers in the same render tick.
    toast("Upgrade to Plus to keep going", {
      id: "quota-upgrade",
      description: "You're on the Free plan today. Plus removes the cap.",
      action: {
        label: "Upgrade",
        onClick: () => {
          window.location.href = "/pricing";
        },
      },
    });
    return true;
  }
  if (res.headers.get("x-quota-warn") === "1") {
    const used = Number(res.headers.get("x-quota-used") ?? "0");
    const limitRaw = res.headers.get("x-quota-limit");
    const limit = limitRaw === "unlimited" ? Infinity : Number(limitRaw);
    if (Number.isFinite(limit) && limit > 0) {
      const remaining = Math.max(0, limit - used);
      if (remaining <= 2) {
        toast("Almost out of your free daily allowance", {
          id: "quota-warn",
          description: "Upgrade to Plus to keep going without limits.",
          action: {
            label: "Upgrade",
            onClick: () => {
              window.location.href = "/pricing";
            },
          },
        });
      }
    }
  }
  return false;
}
