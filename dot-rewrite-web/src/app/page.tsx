import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import Hero from "@/components/landing/hero";
import { ForceLightTheme } from "@/components/force-light-theme";

// `/` lives outside the (landing) route group, so it owns its own chrome.
// Same shape as the (landing) layout so the marketing site looks
// identical regardless of which entry point the user lands on.
//
// Signed-in users are NOT auto-redirected — the Header swaps its CTA
// to "Dashboard" so they can choose to navigate.

export default async function Home() {
  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <ForceLightTheme />
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 right-0 h-[640px] bg-[radial-gradient(circle_520px_at_50%_220px,#C9EBFF,transparent)]"
      />
      <Header />
      <main className="relative mx-auto flex flex-col items-center">
        <Hero />
      </main>
      <div className="relative pt-16 pb-10">
        <Footer />
      </div>
    </div>
  );
}
