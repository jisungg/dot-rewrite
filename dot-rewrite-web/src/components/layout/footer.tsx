import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-transparent">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10 mb-16">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center gap-2">
              <span className="font-medium text-lg">.note</span>
            </div>
            <p className="text-gray-600 max-w-xs">
              Making education smarter through AI. Transform your lecture notes
              into a personal AI tutor.
            </p>
            <p className="text-sm text-gray-500">
              &copy; {currentYear} .note. All rights reserved.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-zinc-900 text-sm uppercase tracking-wider">
              .note
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/pricing"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/integrations"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Integrations
                </Link>
              </li>
              <li>
                <Link
                  href="/changelog"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Documentation
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-zinc-900 text-sm uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Careers
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-zinc-900 text-sm uppercase tracking-wider">
              Legal
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  GDPR
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
