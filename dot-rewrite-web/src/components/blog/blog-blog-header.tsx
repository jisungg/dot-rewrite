"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { formatDate, type BlogPost } from "@/data/blogs/blog/blogs";

export default function BlogBlogHeader({ post }: { post: BlogPost }) {
  return (
    <section className="container pt-32">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <Link
          href="/blog"
          className="inline-flex items-center text-sm text-zinc-500 hover:text-[#0061ff]"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to all articles
        </Link>

        <motion.h1
          className="text-3xl md:text-4xl font-medium tracking-tight text-zinc-900"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {post.title}
        </motion.h1>

        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-500 mb-8">
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Calendar className="h-4 w-4" />
            <time dateTime={post.date}>{formatDate(post.date)}</time>
          </motion.div>
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Clock className="h-4 w-4" />
            <span>{post.readTime}</span>
          </motion.div>
        </div>

        <motion.div
          className="flex flex-wrap justify-center gap-1 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/blog/tag/${encodeURIComponent(tag)}`}
              className="text-[10px] px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
