"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Apple, ChevronRight } from "lucide-react";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AppShowcaseCTA from "./app-showcase";
import FeatureShowcase from "./feature-showcase";
import LettersAI from "./letters-ai";
import LogoCloud from "./logo-cloud";
import NexusVisualization from "./nexus-visualization";

export default function Hero() {
  return (
    <section className="container py-24 pt-32">
      <div className="mx-auto space-y-6">
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/sign-up">
            <AnimatedGradientText>
              🍎 <hr className="mx-2 h-4 w-px shrink-0 bg-gray-300" />{" "}
              <span
                className={cn(
                  "animate-gradient inline bg-gradient-to-r from-[#0061ff] via-[#60efff] to-[#0061ff] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent",
                )}
              >
                .note v1
              </span>
              <ChevronRight className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
            </AnimatedGradientText>
          </Link>
        </motion.div>

        <motion.h1
          className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-900 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Your education, compiled to learn faster
        </motion.h1>

        <motion.p
          className="text-lg text-zinc-500 max-w-xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Manage notes in one place and transform them into an intelligent
          study companion.
        </motion.p>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Link href="/sign-up">
            <Button
              variant="outline"
              className="border-gray-200 text-[#0061ff] hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
            >
              Get started
              <Apple className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <LogoCloud />
          <motion.p
            className="text-xs text-zinc-500 inline mx-auto mt-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            +30 more institutions
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1 }}
        >
          <div className="pt-32 pb-16">
            <h2 className="text-center text-2xl font-medium tracking-tight">
              Designed for modern education. <br />
              Built for focused learning. Powered by your notes.
            </h2>
            <p className="text-center pt-4 text-md text-zinc-600 max-w-3xl mx-auto">
              .note gives you a{" "}
              <span className="text-[#0061ff]">
                beautifully-centralized place
              </span>{" "}
              to study — powered by an AI learning from your notes only. Every
              feature is designed to help you study smarter, without the noise,
              and without the notes.
            </p>
          </div>
          <FeatureShowcase />

          <div className="pt-32 pb-16">
            <h2 className="text-center text-2xl font-medium tracking-tight">
              Dot. <br /> And More.
            </h2>
            <p className="text-center pt-4 text-md text-zinc-600 max-w-3xl mx-auto">
              Alongside Dot, .note includes a lineup of expert AI&apos;s for
              general topics — trained on curated academic data. Meet{" "}
              <span className="text-[#0061ff]">Letters</span>, a collection for
              subjects that have been trained on overarching academic data.
              While Dot focuses on your class, the Letters focuses on
              connecting your studies to public academia.
            </p>
          </div>
          <LettersAI />

          <div className="pt-32 pb-16">
            <h2 className="text-center text-2xl font-medium tracking-tight">
              Introducing Nexus.
            </h2>
            <p className="text-center pt-4 text-md text-zinc-600 max-w-3xl mx-auto">
              <span className="text-[#0061ff]">Nexus</span>
              {" is a visual, semantic learning graph generated from your notes and interactions. As you upload materials or interact with Dot, your concepts are mapped out — showing how everything connects across lectures, notes, and even other classes. See what ideas you\u2019ve mastered, which ones are linked, and where your gaps are."}
            </p>
          </div>
          <NexusVisualization />

          <div className="pt-16 pb-16">
            <h2 className="text-center text-2xl font-medium tracking-tight">
              Get Started.
            </h2>
            <p className="text-center pt-4 text-md text-slate-600 max-w-4xl mx-auto">
              Create your first class, upload your notes, and meet your own AI
              — trained just for you. <br />
              Transform your study experience today with personalized AI
              learning.
            </p>
          </div>
          <AppShowcaseCTA />
        </motion.div>
      </div>
    </section>
  );
}
