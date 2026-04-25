"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, X } from "lucide-react";

import { useTier } from "@/lib/use-tier";

// Small, dismissible banner at the top of the dashboard for users whose
// last invoice failed. Plus access is still granted for the grace
// period; this just nudges them to update their card.
export default function BillingBanner() {
  const { isPastDue } = useTier();
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPastDue || dismissed) return null;

  const openPortal = async () => {
    setError(null);
    setOpening(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        const txt = await res.text().catch(() => `${res.status}`);
        throw new Error(txt);
      }
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("no_portal_url");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setOpening(false);
    }
  };

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 max-w-2xl w-[calc(100%-2rem)]">
      <div className="rounded-lg border border-amber-300/70 dark:border-amber-900/60 bg-amber-50/95 dark:bg-amber-950/60 backdrop-blur px-3 py-2 flex items-center gap-3 text-[12px] text-amber-900 dark:text-amber-100 shadow-sm">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-medium">Payment failed.</span>{" "}
          <span className="opacity-80">
            Update your card to keep Plus active. We&apos;re still letting you in for now.
          </span>
          {error && (
            <span className="block text-red-600 dark:text-red-400 text-[11px] mt-0.5">
              {error}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void openPortal()}
          disabled={opening}
          className="h-7 px-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium inline-flex items-center gap-1"
        >
          {opening ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ExternalLink className="h-3 w-3" />
          )}
          Fix billing
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="h-7 w-7 inline-flex items-center justify-center text-amber-700 dark:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 rounded-md"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
