import BlogHeader from "@/components/blog/blog-header";
import FeaturedPost from "@/components/blog/blog-featured-post";
import BlogList from "@/components/blog/blog-list";
import { blogs, featured_blog, getAllTags } from "@/data/blogs/blog/blogs";

export default function BlogHome() {
  const tags = getAllTags();
  const featured = featured_blog[0];

  return (
    <div className="relative w-full flex flex-col items-center pt-[72px]">
      <BlogHeader />
      {featured && <FeaturedPost post={featured} />}
      <BlogList posts={blogs} tags={tags} />
    </div>
  );
}
