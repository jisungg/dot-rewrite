"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { SmtpMessage } from "@/components/auth/smtp-message";

type AuthLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle: string;
};

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white">
      <div className="absolute bottom-0 left-0 right-0 top-0 pt-14 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]">
        <div className="flex-1 flex items-center justify-center pt-32">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <Link href="/" className="inline-block">
                <AnimatedGradientText className="text-2xl font-medium">
                  .note
                </AnimatedGradientText>
              </Link>
              <h1 className="mt-6 text-2xl font-medium text-zinc-900">
                {title}
              </h1>
              <p className="mt-2 text-zinc-500">{subtitle}</p>
            </div>

            <motion.div
              className="bg-white/80 backdrop-blur-sm rounded-xl border border-zinc-200 shadow-sm overflow-hidden w-full mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {children}
              <div className="h-1 w-full bg-gradient-to-r from-[#0061ff] via-[#60efff] to-[#0061ff] bg-[length:200%_100%] animate-gradient-x" />
            </motion.div>

            <div className="w-full mx-auto">
              <SmtpMessage />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
