import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { ForceLightTheme } from "@/components/force-light-theme";
import { LandingBackground } from "@/components/landing/landing-background";

// One source of truth for the marketing chrome. Every page under
// (landing)/ — home, blog, changelog, pricing — gets:
//
//   - light mode locked (regardless of dashboard preference)
//   - the same pastel background wash behind the header
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
    <div className="relative min-h-screen overflow-x-clip bg-white text-zinc-900">
      <ForceLightTheme />
      <LandingBackground />
      <Header />
      <main className="relative">{children}</main>
      <div className="relative pt-16 pb-10">
        <Footer />
      </div>
    </div>
  );
}
