"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

type AuthState = "loading" | "anon" | "user";

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [auth, setAuth] = useState<AuthState>("loading");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setAuth(data.user ? "user" : "anon");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session?.user ? "user" : "anon");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

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
          {auth === "user" ? (
            <Link href="/dashboard">
              <Button
                variant="default"
                className="bg-[#0061ff] text-white hover:bg-[#0050d6] inline-flex items-center gap-1.5"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/sign-in">
              <Button
                variant="outline"
                className={cn(
                  "border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200",
                  // Avoid layout flicker on first paint while we resolve auth.
                  auth === "loading" && "opacity-70",
                )}
              >
                Log In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
