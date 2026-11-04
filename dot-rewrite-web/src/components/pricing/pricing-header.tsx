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
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-900 dark:text-zinc-100 leading-[1.05]">
            Pricing
          </h1>
        </motion.div>

        <motion.p
          className="text-base md:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          .note is free, I was just testing Stripe's API.
        </motion.p>
      </div>
    </section>
  );
}
