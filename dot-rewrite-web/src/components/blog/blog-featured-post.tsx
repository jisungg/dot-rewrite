"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, type BlogPost } from "@/data/blogs/blog/blogs";

export default function FeaturedPost({ post }: { post: BlogPost }) {
  return (
    <section className="container pb-16">
      <motion.div
        className="max-w-5xl mx-auto border border-gray-300 backdrop-blur-xs rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="p-8 md:p-12">
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <time dateTime={post.date}>{formatDate(post.date)}</time>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{post.readTime}</span>
            </div>
          </div>

          <h2 className="text-2xl md:text-3xl font-medium text-zinc-900 mb-4">
            {post.title}
          </h2>
          <p className="text-zinc-600 mb-6 text-lg">{post.excerpt}</p>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center">
              <span className="text-sm text-zinc-600 font-medium">
                {post.author}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 pt-3">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog/tag/${encodeURIComponent(tag)}`}
                  className="text-[10px] px-2 py-0.5 bg-white border border-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          <Link href={`/blog/${post.slug}`}>
            <Button
              variant="outline"
              className="mt-8 border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
            >
              Read article
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
