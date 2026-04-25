"use client";

import { type ReactNode, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  Calculator,
  Code,
  ChevronDown,
  FlaskRound as Flask,
  Globe,
  Send,
  Library,
  Timer,
} from "lucide-react";

import { DemoFrame } from "./demo-frame";

type LetterAI = {
  letter: string;
  subject: string;
  icon: ReactNode;
  hex: string;
  bgTint: string;
  borderTint: string;
  trainedOn: string[];
  example: string;
  response: Array<
    | { kind: "p"; html: string }
    | { kind: "math"; body: string }
  >;
};

const letters: LetterAI[] = [
  {
    letter: "M",
    subject: "Mathematics",
    icon: <Calculator className="h-3.5 w-3.5" />,
    hex: "#0061ff",
    bgTint: "bg-blue-50",
    borderTint: "border-blue-200",
    trainedOn: [
      "American Mathematical Society journals",
      "Princeton University Press textbooks",
      "MIT OpenCourseWare math curriculum",
      "arXiv mathematics preprints",
    ],
    example: "Why does the chain rule generalize to higher dimensions?",
    response: [
      {
        kind: "p",
        html:
          'For $f: \\mathbb{R}^n \\to \\mathbb{R}^m$ and $g: \\mathbb{R}^m \\to \\mathbb{R}^p$, the chain rule lifts to a matrix product of Jacobians:',
      },
      { kind: "math", body: "D(g ∘ f)(x) = Dg(f(x)) · Df(x)" },
      {
        kind: "p",
        html:
          'Each entry of the composite Jacobian is a sum over partial derivatives, a direct generalization of the 1-D product.',
      },
    ],
  },
  {
    letter: "S",
    subject: "Sciences",
    icon: <Flask className="h-3.5 w-3.5" />,
    hex: "#10b981",
    bgTint: "bg-emerald-50",
    borderTint: "border-emerald-200",
    trainedOn: [
      "Nature & Science journal publications",
      "AAAS research resources",
      "PubMed peer-reviewed studies",
      "Royal Society scientific archives",
    ],
    example: "What's the actual mechanism behind RNA splicing?",
    response: [
      {
        kind: "p",
        html:
          'The <strong>spliceosome</strong>, a ribonucleoprotein complex, recognizes introns by their 5′ splice site, branch point, and 3′ splice site, then catalyzes two transesterification reactions:',
      },
      {
        kind: "math",
        body: "5′-exon — intron — 3′-exon → 5′-exon-3′-exon + lariat",
      },
      {
        kind: "p",
        html:
          'Result: a continuous mature mRNA, ready for export and translation.',
      },
    ],
  },
  {
    letter: "C",
    subject: "Comp. Sci.",
    icon: <Code className="h-3.5 w-3.5" />,
    hex: "#a855f7",
    bgTint: "bg-purple-50",
    borderTint: "border-purple-200",
    trainedOn: [
      "ACM digital library",
      "IEEE Computer Society publications",
      "Stanford & Berkeley CS course materials",
      "Computer Science arXiv preprints",
    ],
    example: "Walk me through how a Bloom filter trades accuracy for memory.",
    response: [
      {
        kind: "p",
        html:
          'A Bloom filter stores set membership in a fixed-size bit array using $k$ independent hash functions. Inserts flip $k$ bits; queries check whether all $k$ bits are set.',
      },
      { kind: "math", body: "P(false positive) ≈ (1 − e^(−kn/m))^k" },
      {
        kind: "p",
        html:
          'You pick $k$ and $m$ for your target false-positive rate. There are no false negatives; only "definitely not present" or "probably present".',
      },
    ],
  },
  {
    letter: "P",
    subject: "Philosophy",
    icon: <BookOpen className="h-3.5 w-3.5" />,
    hex: "#f59e0b",
    bgTint: "bg-amber-50",
    borderTint: "border-amber-200",
    trainedOn: [
      "Stanford Encyclopedia of Philosophy",
      "Oxford University Press publications",
      "JSTOR philosophy collections",
      "Cambridge philosophical archives",
    ],
    example: "Distinguish Kant's categorical imperative from utilitarian ethics.",
    response: [
      {
        kind: "p",
        html:
          'Kant grounds morality in <strong>universalizable maxims</strong>: act only on a rule you could will to be universal law. Consequences are irrelevant; the rational form of the will is what counts.',
      },
      {
        kind: "p",
        html:
          'Utilitarianism instead measures right action by aggregate welfare, following Bentham\'s "greatest good for the greatest number." Same act, opposite test: form vs. outcome.',
      },
    ],
  },
  {
    letter: "H",
    subject: "History",
    icon: <Globe className="h-3.5 w-3.5" />,
    hex: "#ef4444",
    bgTint: "bg-rose-50",
    borderTint: "border-rose-200",
    trainedOn: [
      "Cambridge & Oxford historical archives",
      "American Historical Review",
      "Library of Congress digital collections",
      "Historiographical journal corpus",
    ],
    example: "What's the historiographical debate over the causes of WWI?",
    response: [
      {
        kind: "p",
        html:
          'Three schools dominate. <strong>Fischer</strong>: German aggression as planned policy. <strong>Sleepwalkers</strong> (Clark): a continent-wide failure of strategic imagination. <strong>Long-fuse structuralists</strong>: alliance systems and arms races made war inevitable once Sarajevo fired the spark.',
      },
      {
        kind: "p",
        html:
          'Modern consensus: contingency mattered more than any single actor, but Berlin\'s blank check to Vienna closes most of the alternative paths.',
      },
    ],
  },
];

function inline(html: string): string {
  return html
    .replace(/<strong>/g, '<strong class="font-medium text-slate-900">')
    .replace(
      /\$([^$]+)\$/g,
      '<span class="font-mono text-[0.9em] text-slate-800">$1</span>',
    );
}

export default function LettersAI() {
  const [activeLetter, setActiveLetter] = useState(0);
  const active = letters[activeLetter]!;

  return (
    <div className="space-y-5">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
          {letters.map((l, i) => (
            <button
              key={l.letter}
              onClick={() => setActiveLetter(i)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2 transition-all ${
                i === activeLetter
                  ? `${l.borderTint} ${l.bgTint}`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              style={
                i === activeLetter
                  ? { boxShadow: `0 6px 22px -10px ${l.hex}66` }
                  : undefined
              }
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-medium shadow-sm"
                style={{ backgroundColor: l.hex }}
              >
                {l.letter}
              </span>
              <span
                className={`text-[10px] tracking-wide ${
                  i === activeLetter ? "font-medium text-slate-800" : "text-slate-500"
                }`}
              >
                {l.subject}
              </span>
            </button>
          ))}
        </div>
      </div>

      <DemoFrame
        crumbs={[
          { color: active.hex, text: `Letter ${active.letter}` },
          { text: active.subject.toLowerCase(), muted: true },
        ]}
        rightChip={
          <>
            <Timer className="h-3 w-3" />
            <span className="font-mono">~6s avg</span>
          </>
        }
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active.letter}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] divide-y md:divide-y-0 md:divide-x divide-slate-100"
          >
            <div className="p-4 sm:p-5 space-y-3 bg-[#FAFAFA]/50">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-xl font-medium shadow-sm"
                  style={{ backgroundColor: active.hex }}
                >
                  {active.letter}
                </span>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Letter {active.letter}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {active.subject}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5 flex items-center gap-1">
                  <Library className="h-3 w-3" />
                  Trained on
                </div>
                <ul className="space-y-1.5">
                  {active.trainedOn.map((src) => (
                    <li
                      key={src}
                      className="text-[11.5px] text-slate-700 leading-relaxed flex gap-2"
                    >
                      <span
                        className="mt-1 h-1 w-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: active.hex }}
                      />
                      {src}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-3 bg-white">
              <div className="text-[10px] uppercase tracking-wide font-medium text-slate-500">
                Ask the {active.subject} Letter
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50/40 p-2.5 text-[12px] text-slate-800 flex items-center justify-between gap-2">
                <span className="truncate">{active.example}</span>
                <span
                  className="inline-flex items-center gap-1 rounded text-[10px] text-white px-2 py-0.5 flex-shrink-0"
                  style={{ backgroundColor: active.hex }}
                >
                  <Send className="h-2.5 w-2.5" />
                  Ask
                </span>
              </div>

              <div className="rounded-md border border-slate-200 p-3 space-y-2.5 text-[12.5px] leading-relaxed text-slate-700 min-h-[180px]">
                {active.response.map((r, i) =>
                  r.kind === "math" ? (
                    <div
                      key={i}
                      className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 font-mono text-[12px] text-slate-800"
                    >
                      {r.body}
                    </div>
                  ) : (
                    <p
                      key={i}
                      dangerouslySetInnerHTML={{ __html: inline(r.html) }}
                    />
                  ),
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <ChevronDown className="h-3 w-3" />
                  More follow-ups
                </span>
                <span>Public academia · not your notes</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </DemoFrame>
    </div>
  );
}
