"use client";

import { motion } from "motion/react";

export default function ChangelogVersionHeader({
  version,
}: {
  version: string;
}) {
  return (
    <section className="container py-24 pt-32">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <motion.h1
          className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-900"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Change {version}
        </motion.h1>

        <motion.p
          className="text-lg text-zinc-500 max-w-xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Recent changes for {version}.
        </motion.p>
      </div>
    </section>
  );
}
