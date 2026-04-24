"use client";

import { type ReactNode, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  Calculator,
  Code,
  FlaskRoundIcon as Flask,
  Globe,
} from "lucide-react";

type LetterAI = {
  letter: string;
  name: string;
  subject: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  lightColor: string;
  trainedOn: string[];
};

const letters: LetterAI[] = [
  {
    letter: "M",
    name: "M",
    subject: "Mathematics",
    icon: <Calculator className="h-5 w-5" />,
    color: "text-blue-600",
    bgColor: "bg-blue-600",
    lightColor: "bg-blue-50",
    trainedOn: [
      "American Mathematical Society (AMS) journals",
      "Princeton University Press mathematics textbooks",
      "MIT OpenCourseWare mathematics curriculum",
      "arXiv preprints in mathematics",
      "Cambridge Mathematical Journal",
      "International Congress of Mathematicians proceedings",
    ],
  },
  {
    letter: "S",
    name: "S",
    subject: "Sciences",
    icon: <Flask className="h-5 w-5" />,
    color: "text-green-600",
    bgColor: "bg-green-600",
    lightColor: "bg-green-50",
    trainedOn: [
      "Nature and Science journal publications",
      "AAAS (American Association for the Advancement of Science) resources",
      "National Academy of Sciences research papers",
      "Peer-reviewed studies from PubMed and ScienceDirect",
      "Cell Press journals",
      "Royal Society scientific archives",
    ],
  },
  {
    letter: "C",
    name: "C",
    subject: "Comp. Sci.",
    icon: <Code className="h-5 w-5" />,
    color: "text-purple-600",
    bgColor: "bg-purple-600",
    lightColor: "bg-purple-50",
    trainedOn: [
      "ACM (Association for Computing Machinery) digital library",
      "IEEE Computer Society publications",
      "Official language documentation and specifications",
      "GitHub repositories with MIT and Apache licenses",
      "Stanford and Berkeley CS course materials",
      "NIST computer security publications",
      "Computer Science arXiv preprints",
    ],
  },
  {
    letter: "P",
    name: "P",
    subject: "Philosophy",
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-amber-600",
    bgColor: "bg-amber-600",
    lightColor: "bg-amber-50",
    trainedOn: [
      "Stanford Encyclopedia of Philosophy",
      "Oxford University Press philosophy publications",
      "JSTOR philosophy collections",
      "Project Gutenberg philosophical works",
      "Cambridge University philosophical archives",
      "Journal of Philosophy",
      "Philosophical Review archives",
    ],
  },
  {
    letter: "H",
    name: "H",
    subject: "History",
    icon: <Globe className="h-5 w-5" />,
    color: "text-red-600",
    bgColor: "bg-red-600",
    lightColor: "bg-red-50",
    trainedOn: [
      "American Historical Review",
      "Journal of Modern History",
      "Oxford University Press historical texts",
      "Library of Congress digital archives",
      "National Archives historical documents",
      "Cambridge Historical Journal",
      "Historical primary source collections",
    ],
  },
];

const examples: Record<number, ReactNode> = {
  0: (
    <div className="bg-white rounded-lg border border-blue-100 p-4 shadow-sm">
      <div className="text-sm text-blue-800">
        <div className="font-medium mb-2">
          According to Princeton University&apos;s &quot;Principles of
          Mathematical Analysis&quot; (Rudin, 2006):
        </div>
        <div className="math-handwriting text-lg mb-3">
          &quot;The Riemann Hypothesis states that all non-trivial zeros of the
          zeta function have real part equal to 1/2.&quot;
        </div>
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
          Your calculus class might cover basic integration, but Letter M
          connects you to advanced number theory and unsolved mathematical
          problems that can inspire graduate-level research directions.
        </div>
      </div>
    </div>
  ),
  1: (
    <div className="bg-white rounded-lg border border-green-100 p-4 shadow-sm">
      <div className="text-sm text-green-800">
        <div className="font-medium mb-2">
          From Nature journal (Vol. 598, October 2021):
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
            H₂O
          </div>
          <div className="flex-1">
            &quot;Recent studies on water molecule behavior under quantum
            conditions reveal unexpected quantum tunneling effects at
            temperatures above 20K.&quot;
          </div>
        </div>
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
          Beyond your chemistry textbook&apos;s basics, Letter S introduces
          cutting-edge research that bridges undergraduate concepts with
          doctoral-level scientific exploration, helping you see potential
          career paths in research science.
        </div>
      </div>
    </div>
  ),
  2: (
    <div className="bg-white rounded-lg border border-purple-100 p-4 shadow-sm">
      <div className="text-sm text-purple-800">
        <div className="font-medium mb-2">
          From Stanford&apos;s CS curriculum (COMPSCI 161: Design and Analysis
          of Algorithms):
        </div>
        <div className="bg-zinc-900 rounded p-3 font-mono text-xs overflow-hidden mb-3">
          <pre className="text-purple-300">
            <span className="text-blue-300">
              {"// Randomized QuickSort implementation with Lomuto partition"}
            </span>
            <br />
            <span className="text-blue-300">function</span>{" "}
            <span className="text-yellow-300">quickSort</span>(arr, low = 0,
            high = arr.length - 1) {"{"}
            <br />
            &nbsp;&nbsp;<span className="text-blue-300">if</span> (low &lt;
            high) {"{"}
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;
            <span className="text-green-300">
              {"// Choose random pivot to avoid worst-case O(n²)"}
            </span>
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-300">
              const
            </span>{" "}
            pivotIdx = Math.
            <span className="text-yellow-300">floor</span>(Math.
            <span className="text-yellow-300">random</span>() * (high - low + 1)) +
            low;
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;[arr[pivotIdx], arr[high]] = [arr[high],
            arr[pivotIdx]];
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-blue-300">
              const
            </span>{" "}
            p = <span className="text-yellow-300">partition</span>(arr, low,
            high);
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;
            <span className="text-yellow-300">quickSort</span>(arr, low, p - 1);
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;
            <span className="text-yellow-300">quickSort</span>(arr, p + 1, high);
            <br />
            &nbsp;&nbsp;{"}"}
            <br />
            &nbsp;&nbsp;<span className="text-blue-300">return</span> arr;
            <br />
            {"}"}
          </pre>
        </div>
        <div className="text-xs text-purple-600 bg-purple-50 p-2 rounded">
          While your programming class might teach basic sorting, Letter C
          explains advanced algorithm optimizations and theoretical complexity
          analysis used in tech interviews at top companies and graduate-level
          computer science research.
        </div>
      </div>
    </div>
  ),
  3: (
    <div className="bg-white rounded-lg border border-amber-100 p-4 shadow-sm">
      <div className="text-sm text-amber-800">
        <div className="font-medium mb-2">
          From Stanford Encyclopedia of Philosophy (2023 edition):
        </div>
        <div className="italic mb-3 border-l-2 border-amber-200 pl-3">
          &quot;Kant&apos;s Categorical Imperative represents a deontological
          ethical framework that judges the morality of an action based on
          rules rather than consequences. This stands in contrast to
          utilitarian approaches that focus on outcomes.&quot;
        </div>
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          Beyond introductory ethics discussions, Letter P helps you explore
          how philosophical frameworks influence modern policy debates,
          bioethics decisions, and AI governance—connecting classroom theory to
          real-world ethical dilemmas.
        </div>
      </div>
    </div>
  ),
  4: (
    <div className="bg-white rounded-lg border border-red-100 p-4 shadow-sm">
      <div className="text-sm text-red-800">
        <div className="font-medium mb-2">
          From Oxford University&apos;s &quot;The Oxford History of the
          American People&quot; (Morison, 1965):
        </div>
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium">Primary Source Analysis:</span>
            <span>The Federalist Papers, 1787-1788</span>
          </div>
          <div className="border-l-2 border-red-200 pl-3 italic">
            &quot;Madison&apos;s arguments in Federalist No. 10 reveal
            sophisticated understanding of faction dynamics that transcends the
            immediate political context, establishing principles of
            representative democracy still debated by constitutional scholars
            today.&quot;
          </div>
        </div>
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          While your history class might cover basic events and timelines,
          Letter H provides historiographical analysis and primary source
          interpretation methods used by professional historians to understand
          how historical narratives shape current geopolitical realities.
        </div>
      </div>
    </div>
  ),
};

export default function LettersAI() {
  const [activeAI, setActiveAI] = useState(0);
  const active = letters[activeAI]!;

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-12 relative">
        <div className="flex justify-center mb-1">
          <div className="flex justify-between space-x-8 border-b border-gray-100 w-full max-w-2xl">
            {letters.map((letter, index) => (
              <motion.button
                key={letter.subject}
                className={`flex-1 pb-4 pt-2 px-2 relative flex flex-col items-center transition-colors ${
                  activeAI === index
                    ? letter.color
                    : "text-gray-400 hover:text-zinc-600"
                }`}
                onClick={() => setActiveAI(index)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full ${
                      activeAI === index ? letter.lightColor : "bg-gray-100"
                    } ${activeAI === index ? letter.color : "text-gray-500"}`}
                  >
                    {letter.icon}
                  </div>
                  <span className="font-medium">{letter.name}</span>
                </div>
                <span className="text-xs opacity-70">{letter.subject}</span>

                {activeAI === index && (
                  <motion.div
                    className={`absolute bottom-0 left-0 right-0 h-0.5 ${letter.bgColor}`}
                    layoutId="activeIndicator"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-400 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeAI}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-8 h-[460px] overflow-y-auto"
          >
            <div className="flex items-center gap-4 mb-6">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full text-xl font-bold ${active.lightColor} ${active.color}`}
              >
                {active.letter}
              </div>
              <div>
                <h3 className="text-xl font-medium text-zinc-900">
                  {active.name}
                </h3>
                <p className="text-zinc-600 text-sm">{active.subject}</p>
              </div>
            </div>

            <div className="mb-6">{examples[activeAI]}</div>

            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-sm font-medium text-zinc-900 mb-3">
                Academic sources include:
              </h4>
              <div className="flex flex-wrap gap-2">
                {active.trainedOn.slice(0, 4).map((source) => (
                  <span
                    key={source}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                  >
                    {source}
                  </span>
                ))}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                  +{active.trainedOn.length - 4} more sources
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 text-center max-w-xl mx-auto">
        <p className="text-gray-500 text-sm mb-4">
          Unlike Dot which learns from your specific class materials, Letters
          connect your studies to broader academic knowledge.
        </p>
      </div>
    </div>
  );
}
