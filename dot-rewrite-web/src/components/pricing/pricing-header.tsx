"use client";

import { motion } from "motion/react";

export default function PricingHeader() {
  return (
    <section className="container mx-auto px-4 pt-32 pb-12">
      <div className="max-w-3xl mx-auto text-center space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-[#0061ff] font-medium px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 mb-4">
            <span className="h-1 w-1 rounded-full bg-[#0061ff]" />
            Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100 leading-[1.05]">
            Two tiers.
          </h1>
        </motion.div>

        <motion.p
          className="text-base md:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          Free gives you the full surface: editor, notes, basic Nexus, basic
          Insights, and daily allowances of every AI tool. Plus removes the caps
          and unlocks the deep intelligence layer.
        </motion.p>
      </div>
    </section>
  );
}
