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
    <section className="container py-24 pt-32" key="home">
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
          Smaller, more <span className="text-[#0061ff]">compact</span> notes to
          learn faster.
        </motion.h1>

        <motion.p
          className="text-base md:text-lg text-zinc-600 max-w-2xl mx-auto text-center leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          .note compresses your notes, finds the relationships between them, and
          gives you an AI tutor trained only on what you wrote. Hopefully you
          took good notes.
        </motion.p>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <LogoCloud />
          <motion.p
            className="text-xs text-zinc-500 mt-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            +0 more institutions (we&apos;re working on it)
          </motion.p>
        </motion.div>

        {/* —— Stations of the tour ——————————————————————— */}

        <LandingSection
          id="features"
          eyebrow="The Difference?"
          title={<>Everyone loves minimalistic studying.</>}
          lead="The AI here doesn't even access the internet (it's banned, actually). The processing pipeline and semantic graph updates dynamically per new note so you don't have to do anything. Most importantly, it's minimal. 😎"
        >
          <FeatureShowcase />
        </LandingSection>

        <LandingSection
          id="dot"
          eyebrow="Who's Dot?"
          title={<>The partner who only knows you and your notes.</>}
          lead="Dot is self-contained, reading only the notes you choose, in the workspace that you choose. Every answer is written the way you wrote it, with plain prose, with citations (to your notes)."
        >
          <MeetDot />
        </LandingSection>

        <LandingSection
          id="letters"
          eyebrow="If you want more?"
          title={<>Letters, per academic discipline.</>}
          lead="Dot it your personal partner. Each of the Letters connect your notes (if you're curious) to public academia, and is trained on a curated, auditable corpus per subject."
        >
          <LettersAI />
        </LandingSection>

        <LandingSection
          id="nexus"
          eyebrow="Introducing Nexus?"
          title={<>How does Note A relate to Note B, and if so, in what way?</>}
          lead="Nexus embeds every note into a semantic graph, using Leiden clustering by topic, typed prerequisite edges, and centrality-ranked anchor concepts. See if notes are related, or depend on each other."
        >
          <NexusVisualization />
        </LandingSection>

        <LandingSection
          id="relationships"
          eyebrow="Want the specifics?"
          title={<>Why does Note A relate to Note B? What defines a cluster?</>}
          lead="The Relationships tab shows evidence behind the Nexus visualization, including the topic hierarchy, key terms behind each cluster, and the noise the engine threw out. (Could probably help you study?)"
        >
          <RelationshipsShowcase />
        </LandingSection>

        <LandingSection
          id="get-started"
          eyebrow="Why not try it just once?"
          title={<>Just write your first note, and it'll be smooth sailing.</>}
          lead="Free tier covers your first three classes. Sign up, and start noting."
          spacing="tight"
        >
          {/* <AppShowcaseCTA />
          <div className="mt-10 flex justify-center">
            <Link href="/sign-up">
              <Button className="press bg-[#0061ff] hover:bg-[#0052d6] text-white shadow-[0_8px_22px_-8px_rgba(0,97,255,0.55)]">
                Start your first class
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </Link> */}
          {/* </div> */}
          <div className="mt-10 flex justify-center">
            <Link href="/#home">
              <Button className="press bg-[#0061ff] hover:bg-[#0052d6] text-white shadow-[0_8px_22px_-8px_rgba(0,97,255,0.55)]">
                Back to Top ⬆️
              </Button>
            </Link>
          </div>
        </LandingSection>
      </div>
    </section>
  );
}
