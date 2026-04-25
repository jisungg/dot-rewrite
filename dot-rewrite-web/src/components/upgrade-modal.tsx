"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Check } from "lucide-react";

export type UpgradeReason =
  | { kind: "quota"; quotaKind: string; limit: number; window: "day" | "week" }
  | { kind: "feature"; feature: string }
  | { kind: "spaces"; current: number; limit: number }
  | { kind: "notes"; current: number; limit: number };

type Props = {
  open: boolean;
  reason: UpgradeReason | null;
  onClose: () => void;
};

const PLUS_BENEFITS = [
  "Unlimited Dot, Letters, Understand, and Exam",
  "Unlimited spaces and notes",
  "Full Nexus intelligence (anchors, bridges, contradictions, dependency chains)",
  "LLM-extracted typed relations and labeled communities",
  "Priority engine analysis and unlimited summaries",
];

function reasonHeading(reason: UpgradeReason | null): string {
  if (!reason) return "Upgrade to Plus";
  switch (reason.kind) {
    case "quota":
      return "You've hit today's free limit.";
    case "feature":
      return "This is a Plus feature.";
    case "spaces":
      return `Free is capped at ${reason.limit} spaces.`;
    case "notes":
      return `Free is capped at ${reason.limit} notes per space.`;
  }
}

function reasonDetail(reason: UpgradeReason | null): string {
  if (!reason) return "";
  switch (reason.kind) {
    case "quota":
      return reason.window === "week"
        ? `Resets next week. Plus removes the cap entirely.`
        : `Resets at midnight. Plus removes the cap entirely.`;
    case "feature":
      return `${reason.feature} is part of Plus. Free still gets the basic graph and Insights.`;
    case "spaces":
      return `You currently have ${reason.current}. Plus is unlimited.`;
    case "notes":
      return `You currently have ${reason.current} in this space. Plus is unlimited.`;
  }
}

export function UpgradeModal({ open, reason, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div
            className="relative w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 border border-gray-100/80 dark:border-zinc-800 shadow-xl overflow-hidden"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute top-3 right-3 h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-5 border-b border-gray-100/80 dark:border-zinc-800">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                <Sparkles className="h-3 w-3" />
                Plus Student · $7/mo
              </div>
              <h2 className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {reasonHeading(reason)}
              </h2>
              <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
                {reasonDetail(reason)}
              </p>
            </div>

            <ul className="p-5 space-y-2">
              {PLUS_BENEFITS.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-[12px] text-zinc-700 dark:text-zinc-200"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="p-5 pt-0 flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3 rounded-md text-[12px] text-zinc-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                Maybe later
              </button>
              <Link
                href="/pricing"
                className="h-9 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium inline-flex items-center gap-1.5"
                onClick={onClose}
              >
                <Sparkles className="h-3.5 w-3.5" />
                See Plus
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
