"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Sparkles, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

type BillingCycle = "monthly" | "annual";

type Plan = {
  name: string;
  tagline: string;
  monthlyPrice: string;
  annualPrice: string;
  period: string;
  cta: string;
  highlight: boolean;
  features: Array<{ label: string; delta?: string }>;
};

const plans: Plan[] = [
  {
    name: "Free",
    tagline: "Real value forever, built for casual study.",
    monthlyPrice: "$0",
    annualPrice: "$0",
    period: "forever",
    cta: "Get started",
    highlight: false,
    features: [
      { label: "Editor, notes, spaces", delta: "Always free" },
      { label: "Up to 3 spaces", delta: "Plus: unlimited" },
      { label: "150 notes per space", delta: "Plus: unlimited" },
      { label: "Nexus graph + community hulls", delta: "Plus: + anchors, typed relations, labeled communities" },
      { label: "Basic Insights (orphans, emerging)", delta: "Plus: all 7 (bridges, anchors, contradictions, chains, reach…)" },
      { label: "Dot: 20 messages per day", delta: "Plus: unlimited" },
      { label: "Letters: 15 messages per day across all 5", delta: "Plus: unlimited" },
      { label: "Understand: 3 packs per day", delta: "Plus: unlimited" },
      { label: "Exam: 1 per week", delta: "Plus: unlimited" },
      { label: "Auto-summaries: 10 per day", delta: "Plus: unlimited" },
      { label: "Manual engine analysis: 5 per day", delta: "Plus: unlimited and priority" },
    ],
  },
  {
    name: "Plus Student",
    tagline: "For when you're going deep.",
    monthlyPrice: "$7",
    annualPrice: "$5",
    period: "per month",
    cta: "Go Plus",
    highlight: true,
    features: [
      { label: "Everything in Free, with no daily caps" },
      { label: "Unlimited spaces and notes" },
      { label: "Full Nexus intelligence: anchors (god-nodes), bridges, typed relations, and labeled communities" },
      { label: "All 7 Insight kinds: bridges, anchors, dependency chains, contradictions, concept reach, emerging clusters, and orphans" },
      { label: "LLM-extracted typed relations on bridge + anchor notes" },
      { label: "Unlimited Dot, Letters, Understand, Exam" },
      { label: "Unlimited summaries; priority engine analysis" },
      { label: "Markdown space-bundle export + per-note PDF" },
    ],
  },
];

export default function PricingPlans() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const startCheckout = async () => {
    setCheckoutError(null);
    // Must be signed in to start checkout — bounce to sign-up otherwise.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/sign-up?intent=plus");
      return;
    }
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cycle: billingCycle === "annual" ? "yearly" : "monthly",
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => `${res.status}`);
        throw new Error(txt || `request failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("no_checkout_url");
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : String(err));
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="container pt-10 pb-20">
      <div className="flex flex-col items-center mb-10 space-y-2">
        <div className="inline-flex items-center p-1 bg-zinc-100 dark:bg-zinc-800 rounded-full">
          {(["monthly", "annual"] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-4 py-2 text-sm font-medium rounded-full capitalize transition-all ${
                billingCycle === cycle
                  ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-zinc-700/40 hover:text-blue-700 dark:hover:text-blue-300"
              }`}
            >
              {cycle}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-[#0061ff] font-medium mt-3">
          Save ~28% with annual billing on Plus
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto items-stretch">
        {plans.map((plan, index) => {
          const priceText =
            billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;

          return (
            <motion.div
              key={plan.name}
              className={`flex flex-col rounded-xl overflow-hidden ${
                plan.highlight
                  ? "bg-[#0061ff] border-2 border-[#0061ff] text-white"
                  : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className="flex flex-col justify-between p-6 h-full">
                <div className="flex flex-col grow">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-xl font-medium ${
                        plan.highlight
                          ? "text-white"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}
                    >
                      {plan.name}
                    </h3>
                    {plan.highlight && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-white/15 text-white rounded-full px-2 py-0.5">
                        <Sparkles className="h-3 w-3" />
                        Popular
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-1 text-sm ${
                      plan.highlight
                        ? "text-blue-100"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {plan.tagline}
                  </p>
                  <div className="mt-5 mb-5">
                    <span
                      className={`text-3xl font-medium ${
                        plan.highlight
                          ? "text-white"
                          : "text-zinc-900 dark:text-zinc-100"
                      }`}
                    >
                      {priceText}
                    </span>
                    <span
                      className={`ml-2 text-sm ${
                        plan.highlight
                          ? "text-blue-100"
                          : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      {plan.period}
                    </span>
                    {plan.highlight && billingCycle === "annual" && (
                      <div className="text-[11px] text-blue-100 mt-1">
                        Billed annually at $60
                      </div>
                    )}
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.label}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            plan.highlight ? "text-blue-100" : "text-emerald-500"
                          }`}
                        />
                        <div className="min-w-0">
                          <div
                            className={
                              plan.highlight
                                ? "text-blue-50"
                                : "text-zinc-700 dark:text-zinc-200"
                            }
                          >
                            {feature.label}
                          </div>
                          {feature.delta && (
                            <div
                              className={`text-[11px] mt-0.5 ${
                                plan.highlight
                                  ? "text-blue-200/80"
                                  : "text-zinc-500 dark:text-zinc-400"
                              }`}
                            >
                              {feature.delta}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {plan.highlight ? (
                  <Button
                    variant="secondary"
                    onClick={startCheckout}
                    disabled={checkoutLoading}
                    className="w-full bg-white text-[#0061ff] hover:bg-blue-50 inline-flex items-center justify-center gap-2"
                  >
                    {checkoutLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {plan.cta}
                  </Button>
                ) : (
                  <Link href="/sign-up">
                    <Button
                      variant="outline"
                      className="w-full border-gray-200 dark:border-zinc-700 text-[#0061ff] hover:bg-blue-50 dark:hover:bg-zinc-800"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                )}
                {plan.highlight && checkoutError && (
                  <div className="mt-2 text-[11px] text-blue-100/90">
                    Couldn't start checkout: {checkoutError}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="max-w-3xl mx-auto mt-8 flex items-start gap-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
        <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-zinc-700 dark:text-zinc-200">
          <span className="font-medium">Plus Student</span> is the only paid tier
          today, built around how a student actually uses the app. No long
          contracts, cancel anytime; the Free tier is permanent and not a trial.
        </div>
      </div>
    </section>
  );
}
