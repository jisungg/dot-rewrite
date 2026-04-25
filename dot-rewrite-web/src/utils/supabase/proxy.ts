import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getUser();
  const authed = !error && !!data.user;
  const { pathname } = request.nextUrl;

  // /auth/callback must always be allowed through — exchanges the code for a session.
  if (pathname.startsWith("/auth/")) {
    return response;
  }

  if (pathname.startsWith("/dashboard") && !authed) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (
    authed &&
    (pathname === "/" ||
      pathname === "/sign-in" ||
      pathname === "/sign-up" ||
      pathname === "/forgot-password")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
