export type BlogPost = {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  readTime: string;
  author: string;
  tags: string[];
};

export const featured_blog: BlogPost[] = [
  {
    title: "Introducing .note: Your New Favorite Study Companion",
    slug: "launch",
    date: "March 28, 2025",
    excerpt:
      ".note is officially live in beta. Learn how we're reimagining collaborative note-taking for students and teams everywhere.",
    readTime: "3 min read",
    author: "Team .note",
    tags: ["Launch", "Product", "Study Tools"],
  },
];

export const blogs: BlogPost[] = [
  {
    title: "Introducing .note: Your New Favorite Study Companion",
    slug: "launch",
    date: "March 28, 2025",
    excerpt:
      ".note is officially live in beta. Learn how we're reimagining collaborative note-taking for students and teams everywhere.",
    readTime: "3 min read",
    author: "Team .note",
    tags: ["Launch", "Product", "Study Tools"],
  },
];

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return blogs.find((post) => post.slug === slug);
}

export function getBlogPostsByTag(tag: string): BlogPost[] {
  return blogs.filter((post) => post.tags.includes(tag));
}

export function getAllTags(): string[] {
  const allTags = blogs.flatMap((post) => post.tags);
  return [...new Set(allTags)].sort();
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
