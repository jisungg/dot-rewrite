"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ChevronDown,
  Files,
  Pilcrow,
  Settings,
  LogOut,
  Network,
  BookOpenCheck,
  GraduationCap,
  ScanText,
  TextQuote,
  BotMessageSquare,
  Pin,
  Check,
  Search,
} from "lucide-react";

import { DemoFrame } from "./demo-frame";

type Feature = {
  key: "dot" | "scope" | "central" | "you";
  title: string;
  description: string;
  spaceColor: string;
  spaceName: string;
  tab: string;
};

const features: Feature[] = [
  {
    key: "dot",
    title: "Built from your notes",
    description:
      "Every AI surface in .note — Dot, summaries, exam questions, grading — is grounded strictly in what you wrote. No textbook detours, no outside facts.",
    spaceColor: "#22b8cf",
    spaceName: "Calculus II",
    tab: "dot",
  },
  {
    key: "scope",
    title: "Keep it in scope",
    description:
      "Ask about a single class, a single note, or a single proof. The retrieval engine only looks where you point it — never past your space's walls.",
    spaceColor: "#0061ff",
    spaceName: "All Notes",
    tab: "notes",
  },
  {
    key: "central",
    title: "Minimalist, focused, central",
    description:
      "One workspace per class. Editor, notes, semantic graph, summaries, agent — all in the same shell, one keystroke apart. No tab-hopping.",
    spaceColor: "#f97316",
    spaceName: "Modern Lit.",
    tab: "shell",
  },
  {
    key: "you",
    title: "Built for you",
    description:
      "Markdown, math, code — write your way. Dark or light. Pinned notes, drag tags, export PDF. The interface adapts to your study, not the other way around.",
    spaceColor: "#10b981",
    spaceName: "CS 61A",
    tab: "editor",
  },
];

const ROTATE_MS = 6000;
const PROGRESS_STEP_MS = 60;

export default function FeatureShowcase() {
  const [activeFeature, setActiveFeature] = useState(0);
  const [progress, setProgress] = useState(0);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (progressRef.current) clearInterval(progressRef.current);
          return 0;
        }
        return p + 1;
      });
    }, PROGRESS_STEP_MS);
  };

  const startRotation = () => {
    if (rotateRef.current) clearInterval(rotateRef.current);
    rotateRef.current = setInterval(() => {
      setActiveFeature((p) => (p + 1) % features.length);
      startProgress();
    }, ROTATE_MS);
  };

  useEffect(() => {
    startProgress();
    startRotation();
    return () => {
      if (rotateRef.current) clearInterval(rotateRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, []);

  const handleClick = (i: number) => {
    setActiveFeature(i);
    startProgress();
    startRotation();
  };

  const active = features[activeFeature]!;

  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 items-start">
        {/* Feature list */}
        <div className="space-y-4 lg:pt-2">
          {features.map((f, i) => (
            <button
              key={f.key}
              onClick={() => handleClick(i)}
              className={`block w-full text-left rounded-xl border px-4 py-3.5 transition-all ${
                activeFeature === i
                  ? "border-blue-200 bg-blue-50/30 shadow-[0_4px_18px_-8px_rgba(0,97,255,0.18)]"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    activeFeature === i ? "bg-[#0061ff]" : "bg-slate-300"
                  }`}
                />
                <h3
                  className={`text-sm font-medium ${
                    activeFeature === i ? "text-slate-900" : "text-slate-700"
                  }`}
                >
                  {f.title}
                </h3>
              </div>
              <p className="text-[12.5px] text-slate-600 leading-relaxed pl-3.5">
                {f.description}
              </p>
              <div className="h-0.5 bg-slate-100 rounded-full overflow-hidden mt-3 ml-3.5">
                <motion.div
                  className="h-full bg-[#0061ff]"
                  initial={false}
                  animate={{
                    width: activeFeature === i ? `${progress}%` : "0%",
                  }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>
            </button>
          ))}
        </div>

        {/* Rotating dashboard surface */}
        <DemoFrame
          crumbs={[
            { color: active.spaceColor, text: active.spaceName },
            { text: active.tab, muted: true },
          ]}
        >
          <div className="relative h-[360px] sm:h-[400px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0"
              >
                {active.key === "dot" && <DotMini />}
                {active.key === "scope" && <NotesMini />}
                {active.key === "central" && <ShellMini />}
                {active.key === "you" && <EditorMini />}
              </motion.div>
            </AnimatePresence>
          </div>
        </DemoFrame>
      </div>
    </div>
  );
}

// -------------- Mini surfaces ---------------

function DotMini() {
  return (
    <div className="grid grid-cols-2 h-full divide-x divide-slate-100">
      <div className="p-4 bg-[#FAFAFA]/50 space-y-3">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          Input
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-600">Focused on</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-700 rounded border border-slate-200 px-1.5 py-0.5">
              All Notes
              <ChevronDown className="h-2.5 w-2.5 opacity-60" />
            </span>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50/40 p-2 text-[11.5px] leading-relaxed text-slate-800 min-h-[60px]">
            Explain the chain rule using only my own derivation notes.
            <span className="inline-block w-px h-3 align-middle bg-slate-400 animate-pulse ml-0.5" />
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1 rounded bg-[#0061ff] text-white text-[10px] px-2 py-0.5">
              Submit
              <ArrowRight className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          Output
        </div>
        <div className="rounded-md border border-slate-200 p-3 space-y-2 text-[11.5px] leading-relaxed text-slate-700 h-[150px] overflow-hidden">
          <p>
            From{" "}
            <span className="rounded px-1 py-px bg-blue-50 text-[#0061ff] border border-blue-100">
              Chain Rule
            </span>
            , differentiating <em>f(g(x))</em> means …
          </p>
          <div className="rounded bg-slate-50 border border-slate-100 px-2 py-1 font-mono text-[10.5px]">
            (f ∘ g)′(x) = f′(g(x)) · g′(x)
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {["Chain Rule", "Power Rule"].map((c) => (
            <span
              key={c}
              className="text-[10px] rounded-full px-1.5 py-0.5 bg-blue-50 text-[#0061ff] border border-blue-100"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function NotesMini() {
  const rows = [
    {
      title: "Vector Projections",
      space: "Linear Algebra",
      color: "#0061ff",
      date: "Apr 24",
      done: true,
    },
    {
      title: "Bayes' Theorem",
      space: "Probability",
      color: "#a855f7",
      date: "Apr 23",
      done: true,
    },
    {
      title: "Power Series Convergence",
      space: "Calculus II",
      color: "#22b8cf",
      date: "Apr 22",
      done: false,
      pinned: true,
    },
    {
      title: "Photosynthesis (light + dark)",
      space: "Biology",
      color: "#10b981",
      date: "Apr 21",
      done: true,
    },
    {
      title: "Causes of WWI",
      space: "Modern Hist.",
      color: "#f97316",
      date: "Apr 20",
      done: true,
    },
  ];
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="relative w-1/2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <div className="rounded border border-slate-200 bg-white pl-7 pr-2 py-1 text-[11px] text-slate-400">
            Search notes...
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-[10px] text-[#0061ff]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0061ff]" />
          Process 3 new
        </span>
      </div>
      <div className="rounded-md border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.5fr] gap-3 px-3 py-1.5 bg-slate-50/60 text-[10px] uppercase tracking-wide text-slate-500">
          <span>Title</span>
          <span>Space</span>
          <span>Edited</span>
          <span>Done</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.6fr_1fr_0.8fr_0.5fr] gap-3 items-center px-3 py-2 border-t border-slate-100 text-[11.5px]"
          >
            <span className="flex items-center gap-1.5 truncate">
              {r.pinned && (
                <Pin className="h-2.5 w-2.5 text-slate-400 flex-shrink-0" />
              )}
              <span className="text-slate-800 truncate">{r.title}</span>
            </span>
            <span className="flex items-center gap-1.5 truncate text-slate-600">
              <span
                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: r.color }}
              />
              {r.space}
            </span>
            <span className="text-slate-500">{r.date}</span>
            <span>
              {r.done ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-200 inline-block" />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShellMini() {
  const tabs = [
    { name: "Editor", icon: Pilcrow },
    { name: "Notes", icon: Files },
    { name: "Nexus", icon: Network },
  ];
  const spaceTabs = [
    { name: "Dot", icon: BotMessageSquare },
    { name: "Outline", icon: TextQuote },
    { name: "TL;DR", icon: ScanText },
    { name: "Relations", icon: Network },
    { name: "Understand", icon: BookOpenCheck },
    { name: "Exam", icon: GraduationCap },
  ];
  return (
    <div className="grid grid-cols-[160px_1fr] h-full">
      <div className="border-r border-slate-100 bg-white p-3 flex flex-col">
        <div className="text-[24px] font-handwriting text-slate-900 mb-3 leading-none">
          .note
        </div>
        <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1.5">
          Home
        </div>
        <div className="space-y-0.5 mb-3">
          {tabs.map((t, i) => (
            <div
              key={t.name}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${
                i === 1
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-500"
              }`}
            >
              <t.icon className="h-3 w-3" />
              {t.name}
            </div>
          ))}
        </div>
        <div className="text-[9px] uppercase tracking-wide text-slate-400 mb-1.5">
          Spaces
        </div>
        <div className="space-y-0.5 flex-1">
          {[
            { name: "Calculus II", color: "#22b8cf" },
            { name: "Modern Lit.", color: "#f97316" },
            { name: "CS 61A", color: "#10b981" },
            { name: "Probability", color: "#a855f7" },
          ].map((s, i) => (
            <div
              key={s.name}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] ${
                i === 1
                  ? "bg-orange-50 text-orange-700"
                  : "text-slate-600"
              }`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </div>
          ))}
        </div>
        <div className="space-y-0.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-slate-500">
            <Settings className="h-3 w-3" />
            Settings
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-slate-500">
            <LogOut className="h-3 w-3" />
            Log out
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          <span className="text-[12px] font-medium text-slate-900">
            Modern Lit.
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">
            space
          </span>
        </div>
        <div className="flex items-center gap-1 mb-3 overflow-x-auto">
          {spaceTabs.map((t, i) => (
            <div
              key={t.name}
              className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10.5px] flex-shrink-0 ${
                i === 0
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              <t.icon className="h-2.5 w-2.5" />
              {t.name}
            </div>
          ))}
        </div>
        <div className="rounded border border-slate-200 p-3 text-[11px] text-slate-500 leading-relaxed h-[200px]">
          <span className="font-medium text-slate-700">Dot:</span> The recurring
          motif of artificial light in{" "}
          <span className="rounded px-1 py-px bg-orange-50 text-orange-700 border border-orange-100">
            Gatsby Symbolism
          </span>{" "}
          mirrors how characters chase visions they can never reach…
        </div>
      </div>
    </div>
  );
}

function EditorMini() {
  return (
    <div className="grid grid-cols-2 h-full divide-x divide-slate-100">
      <div className="p-3 bg-slate-50/40 font-mono text-[11px] leading-relaxed text-slate-700 overflow-hidden">
        <div className="text-slate-400"># Photosynthesis</div>
        <div className="mt-2">
          Plants convert{" "}
          <span className="text-emerald-600">sunlight</span>,{" "}
          <span className="text-emerald-600">CO₂</span>, and{" "}
          <span className="text-emerald-600">water</span> into glucose.
        </div>
        <div className="text-slate-400 mt-3">## Light reactions</div>
        <div className="mt-1">
          Occur in the <strong>thylakoid</strong> membrane.
        </div>
        <div className="mt-1">- Splits H₂O → O₂ + electrons</div>
        <div>- Generates ATP and NADPH</div>
        <div className="text-slate-400 mt-3">## Calvin cycle</div>
        <div className="mt-1">
          Net equation: <span className="text-blue-600">{"$6CO_2 + 6H_2O"}</span>
        </div>
        <div className="text-blue-600">{"→ C_6H_{12}O_6 + 6O_2$"}</div>
      </div>
      <div className="p-4 space-y-3 overflow-hidden">
        <h1 className="text-base font-semibold text-slate-900 tracking-tight">
          Photosynthesis
        </h1>
        <p className="text-[12px] text-slate-700 leading-relaxed">
          Plants convert <em>sunlight</em>, <em>CO₂</em>, and <em>water</em>{" "}
          into glucose.
        </p>
        <h2 className="text-sm font-medium text-slate-900 mt-2">
          Light reactions
        </h2>
        <p className="text-[12px] text-slate-700 leading-relaxed">
          Occur in the <strong>thylakoid</strong> membrane.
        </p>
        <ul className="list-disc pl-4 text-[12px] text-slate-700 space-y-0.5">
          <li>Splits H₂O → O₂ + electrons</li>
          <li>Generates ATP and NADPH</li>
        </ul>
        <h2 className="text-sm font-medium text-slate-900 mt-1">
          Calvin cycle
        </h2>
        <div className="rounded bg-slate-50 border border-slate-100 px-3 py-2 font-mono text-[11px] text-slate-800">
          6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂
        </div>
      </div>
    </div>
  );
}

