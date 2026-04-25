import "server-only";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Lazily-initialised Stripe client. Throws a clear error at call site
 * (instead of import time) so module consumers can still load in
 * environments without billing configured (CI, local dev without keys).
 */
export function stripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  _stripe = new Stripe(key, {
    // Pin to the SDK's bundled API version so the typed surface matches
    // what we send. Bumping the SDK bumps this; behavior stays consistent.
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return _stripe;
}

export function priceFor(cycle: "monthly" | "yearly"): string {
  const id =
    cycle === "monthly"
      ? process.env["STRIPE_PRICE_PLUS_MONTHLY"]
      : process.env["STRIPE_PRICE_PLUS_YEARLY"];
  if (!id) {
    throw new Error(
      `STRIPE_PRICE_PLUS_${cycle.toUpperCase()} not set — create the price in the Stripe dashboard and add the ID to your env.`,
    );
  }
  return id;
}

export function siteOrigin(req?: Request): string {
  const fromEnv = process.env["NEXT_PUBLIC_SITE_URL"];
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (req) {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  }
  return "http://localhost:3000";
}

export function webhookSecret(): string {
  const s = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET not set");
  return s;
}
