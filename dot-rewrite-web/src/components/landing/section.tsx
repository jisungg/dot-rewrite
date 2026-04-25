"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";

// Uniform "station" wrapper for the landing tour. Every showcase
// (Meet Dot, Letters, Nexus, Relationships, …) sits inside one of these,
// so the page reads as a single, premium document with consistent
// rhythm, not a stack of differently-sized blocks.

export function LandingSection({
  eyebrow,
  title,
  lead,
  children,
  id,
  spacing = "default",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  id?: string;
  spacing?: "default" | "tight";
}) {
  const padTop = spacing === "tight" ? "pt-20" : "pt-32";
  return (
    <section id={id} className={`${padTop} pb-12 scroll-mt-28`}>
      <div className="text-center px-4 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {eyebrow && (
            <div className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-[#0061ff] font-medium px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 mb-4">
              <span className="h-1 w-1 rounded-full bg-[#0061ff]" />
              {eyebrow}
            </div>
          )}
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-900">
            {title}
          </h2>
          {lead && (
            <p className="mt-3 text-[15px] text-zinc-600 max-w-2xl mx-auto leading-relaxed">
              {lead}
            </p>
          )}
        </motion.div>
      </div>
      {children}
    </section>
  );
}
