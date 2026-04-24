"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type BillingCycle = "monthly" | "annual";

type Plan = {
  name: string;
  description: string;
  monthlyPrice: string;
  annualPrice: string;
  period: string;
  features: string[];
  cta: string;
  popular: boolean;
  badge?: boolean;
};

const plans: Plan[] = [
  {
    name: "Free",
    description: "Get started with the basics",
    monthlyPrice: "$0",
    annualPrice: "$0",
    period: "forever",
    features: [
      "Upload up to 50 pages",
      "Basic AI tutor",
      "10 AI questions per day",
      "Standard support",
    ],
    cta: "Get started",
    popular: false,
  },
  {
    name: "Verified Student",
    description: "For enrolled students with valid ID",
    monthlyPrice: "$4.99",
    annualPrice: "$3.99",
    period: "per month",
    features: [
      "Upload up to 250 pages",
      "Standard AI tutor",
      "50 AI questions per day",
      "Email support",
      "Basic quiz generation",
    ],
    cta: "Verify student status",
    popular: false,
    badge: true,
  },
  {
    name: "Student Plus",
    description: "Perfect for most students",
    monthlyPrice: "$9.99",
    annualPrice: "$7.99",
    period: "per month",
    features: [
      "Upload up to 500 pages",
      "Advanced AI tutor",
      "Unlimited AI questions",
      "Custom quiz generation",
      "Priority support",
    ],
    cta: "Start free trial",
    popular: true,
  },
  {
    name: "Pro",
    description: "For power users",
    monthlyPrice: "$19.99",
    annualPrice: "$16.99",
    period: "per month",
    features: [
      "Unlimited uploads",
      "Premium AI tutor",
      "Unlimited AI questions",
      "Advanced analytics",
      "Priority support",
      "API access",
    ],
    cta: "Start free trial",
    popular: false,
  },
];

export default function PricingPlans() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

  return (
    <section className="container pt-14 pb-24">
      <div className="flex flex-col items-center mb-12 space-y-2">
        <div className="inline-flex items-center p-1 bg-zinc-100 rounded-full">
          {(["monthly", "annual"] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-4 py-2 text-sm font-medium rounded-full capitalize transition-all ${
                billingCycle === cycle
                  ? "bg-white shadow-sm text-zinc-900"
                  : "text-zinc-500 hover:bg-blue-50 hover:text-blue-700"
              }`}
            >
              {cycle}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-[#0061ff] font-medium mt-3">
          Save 20% with annual billing
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {plans.map((plan, index) => {
          const priceText =
            billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
          const subText = plan.popular ? "text-blue-100" : "text-zinc-500";
          const primaryText = plan.popular ? "text-white" : "text-zinc-900";
          const ctaClass =
            plan.name === "Verified Student"
              ? "bg-green-500 text-white hover:bg-green-600"
              : plan.popular
                ? "bg-white border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                : "border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200";

          return (
            <motion.div
              key={plan.name}
              className={`flex flex-col rounded-xl overflow-hidden ${
                plan.popular
                  ? "bg-[#0061ff] border-2 border-[#0061ff]"
                  : "bg-white border border-zinc-200"
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <div className="flex flex-col justify-between p-6 h-full">
                <div className="flex flex-col grow">
                  <div className="flex items-center gap-2">
                    <h3 className={`text-xl font-medium ${primaryText}`}>
                      {plan.name}
                    </h3>
                    {plan.badge && (
                      <BadgeCheck className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                  <p className={`${subText} mt-1 text-sm`}>
                    {plan.description}
                  </p>
                  <div className="mt-5 mb-5">
                    <span className={`text-3xl font-medium ${primaryText}`}>
                      {priceText}
                    </span>
                    <span className={`${subText} ml-2 text-sm`}>
                      {plan.period}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Check
                          className={`h-4 w-4 ${
                            plan.popular ? "text-blue-100" : "text-zinc-900"
                          } shrink-0 mt-0.5`}
                        />
                        <span
                          className={
                            plan.popular ? "text-blue-50" : "text-zinc-600"
                          }
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href="/sign-up">
                  <Button
                    variant="outline"
                    className={`w-full ${ctaClass}`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
