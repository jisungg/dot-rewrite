import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { adminClient } from "@/utils/supabase/admin";
import { stripe, webhookSecret } from "@/lib/stripe/server";

// Loose-typed admin handle: the auth-helper client doesn't know our DB
// schema, so PostgrestQueryBuilder narrows mutation values to `never`.
// Cast through unknown to a minimal interface that matches the surface
// the webhook needs.
type Admin = {
  from: (table: string) => {
    update: (vals: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<unknown>;
    };
    upsert: (
      vals: Record<string, unknown>,
      opts: { onConflict: string },
    ) => Promise<unknown>;
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{
          data: Record<string, unknown> | null;
          error: unknown;
        }>;
      };
    };
  };
};
function admin(): Admin {
  return adminClient() as unknown as Admin;
}

// Stripe webhook receiver.
//
// We handle the small set of events that move the user between Free
// and Plus, and update subscriptions.status when payment fails.
//
// IMPORTANT: needs the RAW request body for signature verification.
// Next.js App Router returns the raw body via req.text(); we never
// JSON.parse before constructEvent().

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("missing signature", { status: 400 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch (err) {
    console.error("stripe webhook: body read failed:", err);
    return new NextResponse("body_read_failed", { status: 400 });
  }
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, webhookSecret());
  } catch (err) {
    console.error("stripe webhook: signature verify failed:", err);
    return new NextResponse("signature_verification_failed", { status: 400 });
  }
  if (!HANDLED.has(event.type)) {
    // Ack unhandled events so Stripe doesn't retry forever.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  } catch (err) {
    console.error("stripe webhook: handler failed for", event.type, err);
    return new NextResponse("handler_failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// --------------------------------------------------------------------
// handlers
// --------------------------------------------------------------------

async function onCheckoutCompleted(s: Stripe.Checkout.Session): Promise<void> {
  const userId = resolveUserId(s.client_reference_id, s.metadata);
  if (!userId) {
    console.warn("stripe webhook: checkout.session.completed without user_id", s.id);
    return;
  }
  const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
  const subscriptionId =
    typeof s.subscription === "string" ? s.subscription : s.subscription?.id;
  if (!subscriptionId) {
    console.warn("stripe webhook: checkout completed with no subscription id", s.id);
    return;
  }
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  await upsertSubscription(userId, sub, customerId);
}

async function onSubscriptionChanged(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdFromSubscription(sub);
  if (!userId) return;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await upsertSubscription(userId, sub, customerId);
}

async function onSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdFromSubscription(sub);
  if (!userId) return;
  await admin()
    .from("subscriptions")
    .update({
      tier: "free",
      status: "canceled",
      current_period_end: null,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function onPaymentFailed(inv: Stripe.Invoice): Promise<void> {
  // The newer API shape places the subscription under `parent.subscription_details`.
  // Fall back to the legacy top-level field if present.
  const parent = (inv as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id?: string } } };
    subscription?: string | { id?: string };
  }).parent;
  const legacy = (inv as unknown as { subscription?: string | { id?: string } }).subscription;
  const subRef = parent?.subscription_details?.subscription ?? legacy;
  const subscriptionId =
    typeof subRef === "string" ? subRef : subRef?.id;
  if (!subscriptionId) return;
  await admin()
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
}

// --------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------

function resolveUserId(
  ref: string | null | undefined,
  metadata: Stripe.Metadata | null | undefined,
): string | null {
  if (typeof ref === "string" && ref.length > 0) return ref;
  const fromMeta = metadata?.["user_id"];
  return typeof fromMeta === "string" && fromMeta.length > 0 ? fromMeta : null;
}

async function resolveUserIdFromSubscription(
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = sub.metadata?.["user_id"];
  if (typeof fromMeta === "string" && fromMeta.length > 0) return fromMeta;
  // Fallback: look up by stripe_subscription_id.
  const a = admin();
  const { data } = await a
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (data && typeof data["user_id"] === "string") return data["user_id"] as string;
  // Last resort: by customer id.
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data: byCustomer } = await a
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (byCustomer && typeof byCustomer["user_id"] === "string") {
    return byCustomer["user_id"] as string;
  }
  return null;
}

async function upsertSubscription(
  userId: string,
  sub: Stripe.Subscription,
  customerId?: string,
): Promise<void> {
  const isActive =
    sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  const tier = isActive ? "plus" : "free";
  const status: "active" | "past_due" | "canceled" | "paused" =
    sub.status === "active" || sub.status === "trialing"
      ? "active"
      : sub.status === "past_due"
        ? "past_due"
        : sub.status === "paused"
          ? "paused"
          : "canceled";
  // Stripe types put current_period_end on the subscription item; the
  // top-level field still works at runtime via the Subscription
  // object — we read it loosely.
  const periodEndUnix = (sub as unknown as { current_period_end?: number })
    .current_period_end;
  const currentPeriodEnd =
    typeof periodEndUnix === "number"
      ? new Date(periodEndUnix * 1000).toISOString()
      : null;

  await admin()
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        tier,
        status,
        current_period_end: currentPeriodEnd,
        stripe_customer_id: customerId ?? null,
        stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
}
