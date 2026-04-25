"use client";

import { motion } from "motion/react";

export default function ChangelogHeader() {
  return (
    <section className="container py-16 pt-32">
      <div className="max-w-3xl mx-auto text-center space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-[#0061ff] font-medium px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <span className="h-1 w-1 rounded-full bg-[#0061ff]" />
            Changelog
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-900 leading-[1.05]">
            Every <span className="text-[#0061ff]">improvement</span>, in the
            order it shipped.
          </h1>
        </motion.div>

        <motion.p
          className="text-base md:text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          Public, dated, honest. Engine releases, UI tweaks, and the
          occasional bug we caught.
        </motion.p>
      </div>
    </section>
  );
}
