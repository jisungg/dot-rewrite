import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import BlogHeader from "@/components/blog/blog-header";
import FeaturedPost from "@/components/blog/blog-featured-post";
import BlogList from "@/components/blog/blog-list";
import { blogs, featured_blog, getAllTags } from "@/data/blogs/blog/blogs";

export default function BlogHome() {
  const tags = getAllTags();
  const featured = featured_blog[0];

  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white">
      <Header />
      <div className="absolute bottom-0 left-0 right-0 top-0 pt-14 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]">
        <div className="relative mx-auto mt-4 flex flex-col items-center">
          <BlogHeader />
          {featured && <FeaturedPost post={featured} />}
          <BlogList posts={blogs} tags={tags} />
        </div>
        <div className="pt-20 pb-10">
          <Footer />
        </div>
      </div>
    </div>
  );
}
