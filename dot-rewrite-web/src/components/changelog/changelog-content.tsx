"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { motion } from "motion/react";
import { entries } from "@/data/changelogs/changelog/changelogs";

// One dynamic component per version, created once at module scope so
// re-renders don't remount the MDX tree.
const changelogComponents = new Map<string, ComponentType>();
function getChangelogComponent(version: string): ComponentType {
  let C = changelogComponents.get(version);
  if (!C) {
    C = dynamic(() => import(`@/data/changelogs/mdx/${version}.mdx`), {
      ssr: false,
    });
    changelogComponents.set(version, C);
  }
  return C;
}

export default function ChangelogContent({ version }: { version: string }) {
  const exists = entries.some((entry) => entry.version === version);

  if (!exists) {
    notFound();
  }

  const Changelog = getChangelogComponent(version);

  return (
    <div className="prose prose-zinc max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {/* eslint-disable-next-line react-hooks/static-components -- component is cached at module scope, identity is stable */}
        <Changelog />
      </motion.div>
    </div>
  );
}
