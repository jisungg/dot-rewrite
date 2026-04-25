import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { ForceLightTheme } from "@/components/force-light-theme";

// One source of truth for the marketing chrome. Every page under
// (landing)/ — home, blog, changelog, pricing — gets:
//
//   - light mode locked (regardless of dashboard preference)
//   - the same radial-gradient halo behind the header
//   - the shared Header / Footer
//   - normal document flow (no absolute-positioned wrappers that
//     collapse the page to viewport height)
//
// Page components inside this group should render only their content
// in a `<main>` — the chrome is handled here.

export default function LandingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white text-zinc-900">
      <ForceLightTheme />
      {/* Soft halo behind the hero / page title — pointer-events-none
          so it never intercepts clicks or scrolls. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 right-0 h-[640px] bg-[radial-gradient(circle_520px_at_50%_220px,#C9EBFF,transparent)]"
      />
      <Header />
      <main className="relative">{children}</main>
      <div className="relative pt-16 pb-10">
        <Footer />
      </div>
    </div>
  );
}
