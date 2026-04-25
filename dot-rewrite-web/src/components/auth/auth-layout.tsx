"use client";

import { type ReactNode } from "react";
import Link from "next/link";

type AuthLayoutProps = {
  children: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  subtitle: string;
};

// Auth has exactly one palette and a single light eyebrow + accent
// headline pattern that matches every LandingSection on the marketing
// site. We do NOT use:
//   - the theme provider (no `.dark` toggling)
//   - theme tokens (bg-background, text-foreground, …)
//   - the motion library (kept the layout free of any client-only
//     chunked dependency that could trip Turbopack ChunkLoadError on
//     a fresh route navigation)
// Animation comes from the `.fade-in-fast` utility in globals.css.

export function AuthLayout({
  children,
  eyebrow,
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <div
      className="relative min-h-screen w-full"
      style={{
        backgroundColor: "#ffffff",
        color: "#18181b",
        colorScheme: "light",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 right-0 h-[520px]"
        style={{
          background:
            "radial-gradient(circle 520px at 50% 180px, #C9EBFF, transparent)",
        }}
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 fade-in-fast">
            {eyebrow && (
              <div
                className="inline-flex items-center gap-2 text-[10.5px] uppercase font-medium px-2.5 py-1 rounded-full border mb-4"
                style={{
                  letterSpacing: "0.14em",
                  color: "#0061ff",
                  backgroundColor: "#eff6ff",
                  borderColor: "#dbeafe",
                }}
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: "#0061ff" }}
                />
                {eyebrow}
              </div>
            )}
            <h1
              className="text-3xl md:text-4xl font-medium tracking-tight"
              style={{ color: "#18181b", lineHeight: 1.1 }}
            >
              {title}
            </h1>
            <p
              className="mt-3 text-[15px] leading-relaxed"
              style={{ color: "#52525b" }}
            >
              {subtitle}
            </p>
          </div>

          <div
            className="rounded-xl overflow-hidden w-full border fade-in-fast"
            style={{
              backgroundColor: "#ffffff",
              borderColor: "#e4e4e7",
              boxShadow: "0 30px 80px -30px rgba(0, 97, 255, 0.18)",
              animationDelay: "120ms",
            }}
          >
            {children}
            <div
              className="h-[2px] w-full animate-gradient-x"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #0061ff, #60efff, #0061ff)",
                backgroundSize: "200% 100%",
              }}
            />
          </div>

          <div
            className="mt-4 rounded-md border px-5 py-3 text-[13px] leading-relaxed"
            style={{
              backgroundColor: "#f8fafc",
              borderColor: "#e2e8f0",
              color: "#52525b",
            }}
          >
            <p>
              By signing up, you agree to our terms of service and privacy
              policy. We use cookies for analytics and personalized content. We
              do not share your personal information with third parties.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              <Link
                href="/terms-of-service"
                target="_blank"
                className="text-[12.5px] hover:underline"
                style={{ color: "#0061ff" }}
              >
                Terms of Service ↗
              </Link>
              <Link
                href="/privacy-policy"
                target="_blank"
                className="text-[12.5px] hover:underline"
                style={{ color: "#0061ff" }}
              >
                Privacy Policy ↗
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
