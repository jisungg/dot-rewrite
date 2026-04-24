"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { entries, type ChangelogEntry } from "@/data/changelogs/changelog/changelogs";

const tagClass: Record<ChangelogEntry["tag"], string> = {
  Feature: "bg-green-100 text-green-800",
  Improvement: "bg-blue-100 text-blue-800",
  Fix: "bg-yellow-100 text-yellow-800",
};

export default function ChangelogEntries() {
  return (
    <section className="container pb-24">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="relative pl-8 border-l border-zinc-200">
            {entries.map((entry) => (
              <motion.div
                key={entry.version}
                className="mb-16 last:mb-0 relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                viewport={{ once: true }}
              >
                <div className="absolute -left-[44px] mt-1 w-6 h-6 rounded-full bg-white border-4 border-zinc-200" />

                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> {entry.date}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${tagClass[entry.tag]}`}
                  >
                    {entry.tag}
                  </span>
                </div>

                <h2 className="text-xl font-medium text-zinc-900 mb-1">
                  {entry.title}{" "}
                  <span className="text-zinc-500 font-normal">
                    {entry.version}
                  </span>
                </h2>

                <p className="text-zinc-600 mb-4">{entry.description}</p>

                <ul className="space-y-2 mb-6">
                  {entry.changes.map((change) => (
                    <li
                      key={change}
                      className="flex items-start gap-2 text-zinc-600"
                    >
                      <span className="text-zinc-400">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>

                <Link href={`/changelog/${entry.version}`}>
                  <Button
                    variant="outline"
                    className="border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                  >
                    View details
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
