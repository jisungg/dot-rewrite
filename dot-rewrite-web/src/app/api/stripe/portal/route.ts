import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api/auth";
import { errorResponse, HttpError } from "@/lib/api/validate";
import { siteOrigin, stripe } from "@/lib/stripe/server";

// Stripe Billing Portal — users self-serve cancel / resume / update card.
// The customer must already exist (subscriptions.stripe_customer_id set
// by the checkout webhook). Otherwise return 409 so the UI sends them
// to /pricing instead.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { data: subRow } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const customerId = subRow?.stripe_customer_id;
    if (!customerId || typeof customerId !== "string") {
      throw new HttpError(409, "no_customer");
    }
    const session = await stripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteOrigin(req)}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return errorResponse(err);
  }
}
