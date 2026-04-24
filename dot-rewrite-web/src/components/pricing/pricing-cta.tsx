"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export default function PricingCta() {
  return (
    <section className="py-24">
      <div className="container">
        <motion.div
          className="max-w-3xl mx-auto text-center space-y-8 bg-gradient-to-b from-white to-blue-50 p-12 rounded-2xl border border-blue-100"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-medium tracking-tight text-zinc-900">
            Ready to get started?
          </h2>
          <p className="text-lg text-zinc-500">
            Try .note free for 14 days. No credit card required.
          </p>
          <div className="pt-4">
            <Link href="/sign-up">
              <Button
                variant="outline"
                className="border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
              >
                Log In
              </Button>
            </Link>
            <p className="mt-4 text-sm text-zinc-500">
              No credit card required
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
