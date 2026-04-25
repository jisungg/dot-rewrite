// Auth-pages layout. Redirect of authed users to /dashboard is handled
// in `src/middleware.ts` so cookie refresh and gating happen in one place
// (server components can't write cookies, so doing it here as well caused
// a refresh-fail loop with /dashboard).

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
