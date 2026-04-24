import { notFound } from "next/navigation";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
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
    <div className="absolute inset-0 -z-10 h-full w-full bg-white">
      <Header />
      <div className="absolute bottom-0 left-0 right-0 top-0 pt-14 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]">
        <div className="relative mx-auto mt-4 flex flex-col items-center">
          <BlogBlogHeader post={post} />
          <BlogContent slug={blog} />
        </div>
        <div className="pt-20 pb-10">
          <Footer />
        </div>
      </div>
    </div>
  );
}
