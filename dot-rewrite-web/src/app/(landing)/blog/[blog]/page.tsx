import { notFound } from "next/navigation";
import BlogBlogHeader from "@/components/blog/blog-blog-header";
import BlogContent from "@/components/blog/blog-content";
import { getBlogPostBySlug } from "@/data/blogs/blog/blogs";

export default async function BlogPage({
  params,
}: {
  params: Promise<{ blog: string }>;
}) {
  const { blog } = await params;
  const post = getBlogPostBySlug(blog);

  if (!post) {
    notFound();
  }

  return (
    <div className="relative mx-auto mt-4 flex flex-col items-center pt-14">
      <BlogBlogHeader post={post} />
      <BlogContent slug={blog} />
    </div>
  );
}
