"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight, ArrowRight } from "lucide-react";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import AppShowcaseCTA from "./app-showcase";
import FeatureShowcase from "./feature-showcase";
import LettersAI from "./letters-ai";
import LogoCloud from "./logo-cloud";
import MeetDot from "./meet-dot";
import NexusVisualization from "./nexus-visualization";
import RelationshipsShowcase from "./relationships-showcase";
import { LandingSection } from "./section";

export default function Hero() {
  return (
    <section className="container py-24 pt-32">
      <div className="mx-auto space-y-6">
        {/* —— Top of fold ———————————————————————————— */}
        <motion.div
          className="mb-4 flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/sign-up">
            <AnimatedGradientText>
              🍎 <hr className="mx-2 h-4 w-px shrink-0" />{" "}
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
          className="text-4xl md:text-6xl font-medium tracking-tight text-zinc-900 text-center max-w-4xl mx-auto leading-[1.05]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          Your education, <span className="text-[#0061ff]">compiled</span> to
          learn faster.
        </motion.h1>

        <motion.p
          className="text-base md:text-lg text-zinc-600 max-w-2xl mx-auto text-center leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          One workspace per class — editor, notes, semantic graph, and an AI
          tutor that reads only what you wrote. Built for focused, grounded
          study.
        </motion.p>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up">
              <Button
                variant="default"
                className="press bg-[#0061ff] hover:bg-[#0052d6] text-white shadow-[0_8px_22px_-8px_rgba(0,97,255,0.55)]"
              >
                Get started
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          <LogoCloud />
          <motion.p
            className="text-xs text-zinc-500 mt-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            +30 more institutions
          </motion.p>
        </motion.div>

        {/* —— Stations of the tour ——————————————————————— */}

        <LandingSection
          id="features"
          eyebrow="Designed for modern study"
          title={
            <>
              The four ways <span className="text-[#0061ff]">.note</span>{" "}
              changes your study loop.
            </>
          }
          lead="Every surface — editor, processing pipeline, semantic graph, AI tutor — is grounded in your notes. Pick a tour stop below or scroll through them all."
        >
          <FeatureShowcase />
        </LandingSection>

        <LandingSection
          id="dot"
          eyebrow="Meet Dot"
          title={
            <>
              Your study partner —{" "}
              <span className="text-[#0061ff]">trained on your notes only</span>
              .
            </>
          }
          lead="Dot reads only the notes inside the space, retrieves the relevant ones for each question, and answers in plain prose with citations. Nothing invented; nothing borrowed from elsewhere."
        >
          <MeetDot />
        </LandingSection>

        <LandingSection
          id="letters"
          eyebrow="And the Letters"
          title={
            <>
              Five expert <span className="text-[#0061ff]">Letters</span>, one
              per academic discipline.
            </>
          }
          lead="Where Dot focuses on your class, the Letters connect your studies to public academia — each trained on a curated, auditable corpus per subject."
        >
          <LettersAI />
        </LandingSection>

        <LandingSection
          id="nexus"
          eyebrow="Introducing Nexus"
          title={
            <>
              The shape of your knowledge,{" "}
              <span className="text-[#0061ff]">drawn from your notes</span>.
            </>
          }
          lead="Nexus turns your notes into a semantic graph — clusters by topic, draws prerequisite arrows between dependent concepts, and flags pairs students commonly confuse."
        >
          <NexusVisualization />
        </LandingSection>

        <LandingSection
          id="relationships"
          eyebrow="And the Relationships underneath"
          title={
            <>
              See exactly <span className="text-[#0061ff]">why</span> a cluster
              formed.
            </>
          }
          lead="The Relationships tab opens up the structure Nexus visualizes — the topic hierarchy, the evidence terms behind each cluster, and the noise the engine threw out. Browse subjects like a tree, drill into any cluster."
        >
          <RelationshipsShowcase />
        </LandingSection>

        <LandingSection
          id="get-started"
          eyebrow="Get started"
          title={
            <>
              Create a class,{" "}
              <span className="text-[#0061ff]">drop in a note</span>, and meet
              your own AI.
            </>
          }
          lead="Free tier covers your first three classes. No card, no setup wizard — sign in and you're in the editor."
          spacing="tight"
        >
          <AppShowcaseCTA />
          <div className="mt-10 flex justify-center">
            <Link href="/sign-up">
              <Button className="press bg-[#0061ff] hover:bg-[#0052d6] text-white shadow-[0_8px_22px_-8px_rgba(0,97,255,0.55)]">
                Start your first class
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </LandingSection>
      </div>
    </section>
  );
}
