"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, type BlogPost } from "@/data/blogs/blog/blogs";

const PAGE_SIZE = 6;

export default function BlogList({
  posts,
  tags,
}: {
  posts: BlogPost[];
  tags: string[];
}) {
  const [activeTag, setActiveTag] = useState<string>("All");
  const [visiblePosts, setVisiblePosts] = useState(PAGE_SIZE);

  const filteredPosts =
    activeTag === "All"
      ? posts
      : posts.filter((post) => post.tags.includes(activeTag));

  const loadMore = () => setVisiblePosts((prev) => prev + PAGE_SIZE);

  const selectTag = (tag: string) => {
    setActiveTag(tag);
    setVisiblePosts(PAGE_SIZE);
  };

  return (
    <section className="container pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <h2 className="text-2xl font-medium text-zinc-900 mb-6 text-center">
            Latest articles
          </h2>

          <div className="flex justify-center flex-wrap gap-2 max-w-3xl mx-auto">
            <Button
              variant="outline"
              size="sm"
              className={`text-xs px-3 py-1 h-auto rounded-full ${
                activeTag === "All"
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "text-zinc-600 border-zinc-200 hover:bg-zinc-100"
              }`}
              onClick={() => selectTag("All")}
            >
              All
            </Button>
            {tags.map((tag) => (
              <Button
                key={tag}
                variant="outline"
                size="sm"
                className={`text-xs px-3 py-1 h-auto rounded-full ${
                  activeTag === tag
                    ? "bg-zinc-900 text-white border-zinc-900"
                    : "text-zinc-600 border-zinc-200 hover:bg-zinc-100"
                }`}
                onClick={() => selectTag(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500">No articles found in this category.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.slice(0, visiblePosts).map((post, index) => (
                <motion.div
                  key={post.slug}
                  className="flex flex-col bg-white border border-zinc-200 rounded-lg overflow-hidden h-full"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 + 0.4 }}
                  viewport={{ once: true }}
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center text-xs text-zinc-500">
                        <Calendar className="h-3 w-3 mr-1" />
                        <time dateTime={post.date}>
                          {formatDate(post.date)}
                        </time>
                      </div>
                      <div className="flex items-center text-xs text-zinc-500">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900 mb-2">
                      {post.title}
                    </h3>
                    <p className="text-zinc-600 text-sm mb-4 flex-1">
                      {post.excerpt}
                    </p>

                    <div className="mt-auto">
                      <div className="flex flex-wrap gap-1 mb-4">
                        {post.tags.map((tag) => (
                          <Link
                            key={tag}
                            href={`/blog/tag/${encodeURIComponent(tag)}`}
                            className="text-[10px] px-2 py-0.5 bg-zinc-50 border border-zinc-100 rounded-full text-zinc-500 hover:bg-zinc-100 transition-colors"
                          >
                            {tag}
                          </Link>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-600 font-medium">
                          {post.author}
                        </span>
                        <Link
                          href={`/blog/${post.slug}`}
                          className="text-sm font-medium text-[#0061ff] hover:text-blue-700 flex items-center gap-1"
                        >
                          Read more <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {filteredPosts.length > visiblePosts && (
              <div className="mt-12 text-center">
                <Button
                  variant="outline"
                  className="text-zinc-500"
                  onClick={loadMore}
                >
                  Load more articles
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
