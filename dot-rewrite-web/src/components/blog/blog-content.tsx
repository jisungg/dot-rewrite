"use client";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { motion } from "motion/react";
import { blogs } from "@/data/blogs/blog/blogs";

export default function BlogContent({ slug }: { slug: string }) {
  const blogExists = blogs.some((entry) => entry.slug === slug);

  if (!blogExists) {
    notFound();
  }

  const Blog = dynamic(() => import(`@/data/blogs/mdx/${slug}.mdx`), {
    ssr: false,
  });

  return (
    <div className="prose prose-zinc max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Blog />
      </motion.div>
    </div>
  );
}
