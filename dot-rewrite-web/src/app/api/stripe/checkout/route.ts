import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/auth";
import { errorResponse, HttpError } from "@/lib/api/validate";
import { priceFor, siteOrigin, stripe } from "@/lib/stripe/server";

// Create a Stripe Checkout Session for the Plus Student subscription.
// - Reuses an existing Stripe customer if we have one cached on
//   subscriptions.stripe_customer_id; otherwise lets Checkout create one
//   tied to the user's email.
// - automatic_tax enabled per the project policy.
// - Cancel-at-period-end is the default behavior of subscriptions; the
//   billing portal is where users self-serve cancellations.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Cycle = "monthly" | "yearly";

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const cycleRaw = body["cycle"];
    const cycle: Cycle =
      cycleRaw === "yearly" || cycleRaw === "annual" ? "yearly" : "monthly";

    // Look up cached Stripe customer id, if any.
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, tier")
      .eq("user_id", user.id)
      .maybeSingle();

    if (subRow?.tier === "plus") {
      throw new HttpError(409, "already_plus");
    }

    const origin = siteOrigin(req);
    const price = priceFor(cycle);
    const customerId =
      subRow && typeof subRow.stripe_customer_id === "string"
        ? subRow.stripe_customer_id
        : undefined;

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/pricing?canceled=1`,
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      client_reference_id: user.id,
      ...(customerId
        ? { customer: customerId }
        : { customer_email: user.email ?? undefined }),
      // Stash the user_id on the subscription so the webhook can resolve
      // back to the right row even if we created a new customer.
      subscription_data: {
        metadata: { user_id: user.id, cycle },
      },
      metadata: { user_id: user.id, cycle },
    });

    if (!session.url) {
      throw new HttpError(500, "checkout_no_url");
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
