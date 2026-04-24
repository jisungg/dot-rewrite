"use client";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { motion } from "motion/react";
import { entries } from "@/data/changelogs/changelog/changelogs";

export default function ChangelogContent({ version }: { version: string }) {
  const exists = entries.some((entry) => entry.version === version);

  if (!exists) {
    notFound();
  }

  const Changelog = dynamic(
    () => import(`@/data/changelogs/mdx/${version}.mdx`),
    { ssr: false },
  );

  return (
    <div className="prose prose-zinc max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Changelog />
      </motion.div>
    </div>
  );
}
