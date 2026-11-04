"use client";

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { motion } from "motion/react";
import { blogs } from "@/data/blogs/blog/blogs";

// One dynamic component per slug, created once at module scope so
// re-renders don't remount the MDX tree.
const blogComponents = new Map<string, ComponentType>();
function getBlogComponent(slug: string): ComponentType {
  let C = blogComponents.get(slug);
  if (!C) {
    C = dynamic(() => import(`@/data/blogs/mdx/${slug}.mdx`), { ssr: false });
    blogComponents.set(slug, C);
  }
  return C;
}

export default function BlogContent({ slug }: { slug: string }) {
  const blogExists = blogs.some((entry) => entry.slug === slug);

  if (!blogExists) {
    notFound();
  }

  const Blog = getBlogComponent(slug);

  return (
    <div className="prose prose-zinc max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        {/* eslint-disable-next-line react-hooks/static-components -- component is cached at module scope, identity is stable */}
        <Blog />
      </motion.div>
    </div>
  );
}
