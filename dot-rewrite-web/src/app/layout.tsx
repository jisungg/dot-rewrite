import type { Metadata } from "next";
import { Geist_Mono, Mrs_Saint_Delafield } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem("dotnote:theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = stored === "dark" || stored === "light"
      ? stored
      : (prefersDark ? "dark" : "light");
    if (resolved === "dark") document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

const delafield = Mrs_Saint_Delafield({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mrs_saint_delafield",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "(dot)note",
  description: "Your education, compiled to learn faster.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistMono.className} ${delafield.variable} antialiased overscroll-none bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
