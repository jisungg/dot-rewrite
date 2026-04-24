"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl transition-all duration-300",
        scrolled
          ? "bg-white/80 backdrop-blur-xs shadow-sm py-5 rounded-xl"
          : "bg-transparent py-5",
      )}
    >
      <div className="relative container mx-auto flex justify-center items-center px-4">
        <Link
          href="/"
          className="absolute left-4 text-xl font-medium text-gray-900"
        >
          .note
        </Link>

        <nav className="flex items-center space-x-8">
          <Link
            href="/pricing"
            className="text-sm font-medium text-gray-600 hover:text-[#0061ff] transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/blog"
            className="text-sm font-medium text-gray-600 hover:text-[#0061ff] transition-colors"
          >
            Blog
          </Link>
          <Link
            href="/changelog"
            className="text-sm font-medium text-gray-600 hover:text-[#0061ff] transition-colors"
          >
            Changelog
          </Link>
        </nav>

        <div className="absolute right-4 flex items-center space-x-4">
          <Link href="/sign-in">
            <Button
              variant="outline"
              className="border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
            >
              Log In
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
