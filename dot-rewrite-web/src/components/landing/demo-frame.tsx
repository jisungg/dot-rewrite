"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Shared window-chrome shell for landing showcase cards. Mirrors the
// dashboard tab header (space dot + breadcrumb + optional right chip)
// with traffic-light dots, a slate-50 header strip, and a thin animated
// gradient signature at the bottom.

type Crumb = { color?: string; text: string; muted?: boolean };

export function DemoFrame({
  crumbs,
  rightChip,
  children,
  className,
  caption,
  delay = 0,
}: {
  crumbs?: Crumb[];
  rightChip?: ReactNode;
  children: ReactNode;
  className?: string;
  caption?: string;
  delay?: number;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative rounded-2xl border border-slate-200 bg-white shadow-[0_40px_80px_-30px_rgba(0,97,255,0.18)] overflow-hidden",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
            </div>
            {crumbs && crumbs.length > 0 && (
              <div className="ml-2 flex items-center gap-2 text-[11px] min-w-0 truncate">
                {crumbs.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 min-w-0 truncate"
                  >
                    {c.color && (
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                    )}
                    <span
                      className={cn(
                        "truncate",
                        c.muted
                          ? "uppercase tracking-wide text-[10px] text-slate-400"
                          : "font-medium text-slate-700",
                      )}
                    >
                      {c.text}
                    </span>
                    {i < crumbs.length - 1 && (
                      <span className="text-slate-300">·</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {rightChip && (
            <div className="text-[10px] text-slate-500 rounded-md border border-slate-200 px-1.5 py-0.5 bg-white inline-flex items-center gap-1.5">
              {rightChip}
            </div>
          )}
        </div>

        {children}

        <div className="h-[2px] w-full bg-gradient-to-r from-[#0061ff] via-[#60efff] to-[#0061ff] bg-[length:200%_100%] animate-gradient-x" />
      </motion.div>

      {caption && (
        <p className="text-center text-[12px] text-slate-500 mt-5 max-w-xl mx-auto">
          {caption}
        </p>
      )}
    </div>
  );
}
