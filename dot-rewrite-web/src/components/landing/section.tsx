"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";

// Uniform "station" wrapper for the landing tour. Every showcase
// (Meet Dot, Letters, Nexus, Relationships, …) sits inside one of these,
// so the page reads as a single, premium document with consistent
// rhythm, not a stack of differently-sized blocks.
//
// Each station picks an `accent`: its own color pair and a soft gradient
// glow behind the header that slowly rotates and breathes. That glow is
// the only ambient motion; the content itself stays still.

export type SectionAccent =
  | "features"
  | "dot"
  | "letters"
  | "nexus"
  | "relationships"
  | "start";

const ACCENTS: Record<
  SectionAccent,
  { from: string; to: string; text: string; chipBg: string; chipBorder: string }
> = {
  features: { from: "#B9D8FF", to: "#C6F1E4", text: "#0061ff", chipBg: "#EEF5FF", chipBorder: "#D5E6FF" },
  dot: { from: "#BFD4FF", to: "#D9C8FF", text: "#3b5bff", chipBg: "#F0F2FF", chipBorder: "#DCE1FF" },
  letters: { from: "#FFD3C2", to: "#FFE7B3", text: "#d4622b", chipBg: "#FFF4EE", chipBorder: "#FFE0D1" },
  nexus: { from: "#D9C8FF", to: "#FFD6EC", text: "#7c5cff", chipBg: "#F5F1FF", chipBorder: "#E6DCFF" },
  relationships: { from: "#C6F1E4", to: "#BFE6FF", text: "#11906f", chipBg: "#ECFAF5", chipBorder: "#CCEFE3" },
  start: { from: "#FFD6EC", to: "#B9D8FF", text: "#c23a78", chipBg: "#FFF0F7", chipBorder: "#FFD9EA" },
};

export function LandingSection({
  eyebrow,
  title,
  lead,
  children,
  id,
  spacing = "default",
  accent = "features",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  id?: string;
  spacing?: "default" | "tight";
  accent?: SectionAccent;
}) {
  const padTop = spacing === "tight" ? "pt-20" : "pt-32";
  const a = ACCENTS[accent];
  return (
    <section id={id} className={`relative ${padTop} pb-12 scroll-mt-28`}>
      {/* Section glow: a blurred conic gradient in the accent colors that
          slowly turns, plus one drifting field for depth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-4 h-[520px] w-[min(1000px,100vw)] -translate-x-1/2"
      >
        <div
          className="animate-glow-spin absolute left-1/2 top-1/2 -ml-[260px] -mt-[220px] h-[440px] w-[520px] rounded-full opacity-55 blur-[110px]"
          style={{
            backgroundImage: `conic-gradient(from 0deg, ${a.from}, ${a.to}, ${a.chipBg}, ${a.from})`,
          }}
        />
        <div
          className="animate-drift-b absolute right-[10%] top-[30%] h-[260px] w-[260px] rounded-full opacity-40 blur-[100px]"
          style={{ backgroundColor: a.to }}
        />
      </div>

      <div className="relative text-center px-4 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {eyebrow && (
            <div
              className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] font-medium px-2.5 py-1 rounded-full border mb-4"
              style={{ color: a.text, backgroundColor: a.chipBg, borderColor: a.chipBorder }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: a.text }}
              />
              {eyebrow}
            </div>
          )}
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900">
            {title}
          </h2>
          <div
            aria-hidden
            className="mx-auto mt-4 h-[2px] w-16 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${a.text}, ${a.from}, ${a.to})` }}
          />
          {lead && (
            <p className="mt-4 text-[15px] text-zinc-600 max-w-2xl mx-auto leading-relaxed">
              {lead}
            </p>
          )}
        </motion.div>
      </div>
      <div className="relative">{children}</div>
    </section>
  );
}
