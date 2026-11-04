"use client";

import { motion } from "motion/react";

export default function BlogHeader() {
  return (
    <section className="container py-16 pt-32">
      <div className="max-w-3xl mx-auto text-center space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-900 leading-[1.05]">
            Blog
          </h1>
        </motion.div>

        <motion.p
          className="text-base md:text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          Pretty much nothing to see here except a sample introductory blog. Was
          fiddling around with dynamic updates and markdown conversion!
        </motion.p>
      </div>
    </section>
  );
}
