"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

// The hero's signature loop, our answer to the Apple Education Store
// opener. It acts out what .note does:
//
//   1. scatter: messy note fragments float around the stage
//   2. gather:  they're pulled to the center and shrink into dots
//   3. dot:     a single blue dot breathes for a beat
//   4. note:    the dot blooms into one compact, tidy note card
//
// then it fades back out and loops. Positions are fractions of the
// stage size so the layout holds from phone to desktop. Under
// prefers-reduced-motion it just shows the finished card.

type Phase = "scatter" | "gather" | "dot" | "note";

const DURATIONS: Record<Phase, number> = {
  scatter: 3200,
  gather: 1100,
  dot: 900,
  note: 3600,
};

const NEXT: Record<Phase, Phase> = {
  scatter: "gather",
  gather: "dot",
  dot: "note",
  note: "scatter",
};

// x/y are fractions of half the stage width/height, from the center.
const FRAGMENTS = [
  { text: "mitochondria = powerhouse??", x: -0.78, y: -0.62, r: -6, tint: "#0061ff" },
  { text: "∫ f(x) dx", x: 0.62, y: -0.7, r: 5, tint: "#7c5cff" },
  { text: "Krebs cycle → ATP", x: -0.9, y: 0.05, r: 3, tint: "#e8743b" },
  { text: "p < 0.05", x: 0.86, y: -0.08, r: -4, tint: "#14a37f" },
  { text: "TODO: reread ch. 4", x: -0.55, y: 0.72, r: -3, tint: "#d6457a" },
  { text: "supply ≠ demand", x: 0.5, y: 0.66, r: 6, tint: "#0061ff" },
  { text: "1789: Estates-General", x: 0.1, y: -0.92, r: -2, tint: "#e8743b" },
  { text: "F = ma", x: -0.15, y: 0.95, r: 4, tint: "#7c5cff" },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export default function HeroCompress() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("scatter");
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 300 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setPhase((p) => NEXT[p]), DURATIONS[phase]);
    return () => clearTimeout(t);
  }, [phase, reduce]);

  const shown: Phase = reduce ? "note" : phase;
  const halfW = size.w / 2 - 70;
  const halfH = size.h / 2 - 24;

  return (
    <div
      ref={stageRef}
      aria-hidden
      className="relative mx-auto mt-10 h-[260px] w-full max-w-3xl md:h-[300px]"
    >
      {/* Fragments */}
      {FRAGMENTS.map((f, i) => {
        const scattered = shown === "scatter";
        const gathering = shown === "gather";
        return (
          <motion.div
            key={f.text}
            className="absolute left-1/2 top-1/2"
            initial={false}
            animate={
              scattered
                ? {
                    x: f.x * halfW,
                    y: f.y * halfH,
                    opacity: 1,
                    scale: 1,
                    rotate: f.r,
                  }
                : gathering
                  ? { x: 0, y: 0, opacity: 0.9, scale: 0.18, rotate: 0 }
                  : { x: 0, y: 0, opacity: 0, scale: 0.1, rotate: 0 }
            }
            transition={
              scattered
                ? { duration: 1.1, delay: i * 0.06, ease: EASE }
                : { duration: 0.9, delay: i * 0.04, ease: [0.65, 0, 0.35, 1] }
            }
          >
            {/* Inner wrapper floats independently while scattered. */}
            <motion.div
              className="-translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl border border-white/70 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-zinc-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)] backdrop-blur-md md:text-[13px]"
              animate={
                scattered && !reduce
                  ? { y: [0, -6, 0, 5, 0] }
                  : { y: 0 }
              }
              transition={{
                duration: 4 + (i % 3),
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ backgroundColor: f.tint }}
              />
              {f.text}
            </motion.div>
          </motion.div>
        );
      })}

      {/* The dot */}
      <AnimatePresence>
        {(shown === "gather" || shown === "dot") && (
          <motion.div
            key="dot"
            className="absolute left-1/2 top-1/2 -ml-3 -mt-3 h-6 w-6 rounded-full bg-[#0061ff] shadow-[0_0_40px_8px_rgba(0,97,255,0.35)]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: shown === "dot" ? [1, 1.35, 1] : 0.8, opacity: 1 }}
            exit={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          />
        )}
      </AnimatePresence>

      {/* Ripple when the dot blooms into a note. */}
      <AnimatePresence>
        {shown === "note" && !reduce && (
          <motion.div
            key="ripple"
            className="absolute left-1/2 top-1/2 -ml-20 -mt-20 h-40 w-40 rounded-full border border-[#0061ff]/40"
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 2.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* The compact note */}
      <AnimatePresence>
        {shown === "note" && (
          <motion.div
            key="note"
            className="absolute left-1/2 top-1/2 w-[280px] -translate-x-1/2 -translate-y-1/2 md:w-[320px]"
            initial={reduce ? false : { opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -8 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-[0_24px_60px_-24px_rgba(0,97,255,0.45)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#0061ff]" />
                  <span className="text-[12px] font-semibold text-zinc-900">
                    Bio 1A · Ch. 4
                  </span>
                </div>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#0061ff]">
                  8 → 3
                </span>
              </div>
              {[
                "Mitochondria run the Krebs cycle → ATP.",
                "Energy flow links to Ch. 2 (enzymes).",
                "Reread: electron transport chain.",
              ].map((line, i) => (
                <motion.div
                  key={line}
                  className="flex items-start gap-2 py-1 text-[12.5px] leading-snug text-zinc-700"
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.15, duration: 0.4 }}
                >
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                  {line}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
