import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for trusted server-only paths (Stripe
// webhook handlers, migration scripts). Bypasses RLS — never import
// from client components or unauthenticated routes.
//
// Lazily constructed so importing this module doesn't crash builds in
// environments without billing configured.
let _admin: ReturnType<typeof createClient> | null = null;

export function adminClient() {
  if (_admin) return _admin;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL) not set — required for the Stripe webhook to update subscriptions.",
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
