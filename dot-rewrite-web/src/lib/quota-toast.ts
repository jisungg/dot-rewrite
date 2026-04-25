"use client";

import { toast } from "sonner";

// Read the standard quota headers we attach in lib/api/quota.ts and
// raise a soft-warning toast at >=80% utilization. Block (HTTP 429)
// responses raise a different toast that offers an upgrade.
//
// Call from any client fetch:
//   const res = await fetch("/api/letters/chat", { ... });
//   handleQuotaResponse(res, "Letters chat");
export function handleQuotaResponse(res: Response, label: string): void {
  if (res.status === 429) {
    let body: { kind?: string; limit?: number; window?: string } | null = null;
    res
      .clone()
      .json()
      .then((data) => {
        body = data as typeof body;
      })
      .catch(() => {});
    toast.error(`${label} cap reached`, {
      description: body
        ? `Your ${body["window"] ?? "daily"} limit for ${body["kind"] ?? label.toLowerCase()} is ${body["limit"] ?? "—"}. Upgrade to Plus for unlimited.`
        : "Upgrade to Plus to remove the cap.",
      action: {
        label: "See Plus",
        onClick: () => {
          window.location.href = "/pricing";
        },
      },
    });
    return;
  }
  if (res.headers.get("x-quota-warn") === "1") {
    const used = Number(res.headers.get("x-quota-used") ?? "0");
    const limitRaw = res.headers.get("x-quota-limit");
    const limit = limitRaw === "unlimited" ? Infinity : Number(limitRaw);
    if (Number.isFinite(limit) && limit > 0) {
      const remaining = Math.max(0, limit - used);
      toast(`${label} · ${remaining} left today`, {
        description:
          remaining === 0
            ? "You've used everything. Upgrade to Plus for unlimited."
            : "Plus removes the cap entirely.",
      });
    }
  }
}
