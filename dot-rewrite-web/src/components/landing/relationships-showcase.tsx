"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  FolderTree,
  Layers,
  Sparkles,
  Star,
  GitBranch,
} from "lucide-react";

import { DemoFrame } from "./demo-frame";

type Cluster = {
  id: string;
  parent: string;
  branch: string;
  label: string;
  size: number;
  cohesion: number;
  evidence: string[];
  excluded: string[];
  notes: string[];
  related: string[];
};

const tree = [
  {
    label: "Mathematics",
    children: [
      {
        label: "Linear Algebra",
        children: [
          { id: "vec-proj", label: "Vector Projections", size: 4 },
          { id: "orthogonality", label: "Orthogonality", size: 3 },
          { id: "dot-product", label: "Dot Product", size: 5 },
        ],
      },
      {
        label: "Calculus",
        children: [
          { id: "derivatives", label: "Derivatives", size: 6 },
          { id: "chain-rule", label: "Chain Rule", size: 4 },
        ],
      },
    ],
  },
  {
    label: "Probability",
    children: [
      {
        label: "Conditional",
        children: [
          { id: "bayes", label: "Bayes' Theorem", size: 5 },
        ],
      },
    ],
  },
];

const clusters: Record<string, Cluster> = {
  "vec-proj": {
    id: "vec-proj",
    parent: "Mathematics",
    branch: "Linear Algebra",
    label: "Vector Projections",
    size: 4,
    cohesion: 0.78,
    evidence: ["projection", "dot product", "direction", "parallel"],
    excluded: ["proj", "mathbf", "text", "onto"],
    notes: [
      "Projection of a vector onto another",
      "Scalar vs. vector projection",
      "Geometric meaning of proj_b a",
      "Worked example: projection onto y=x",
    ],
    related: ["Dot Product", "Orthogonality"],
  },
  orthogonality: {
    id: "orthogonality",
    parent: "Mathematics",
    branch: "Linear Algebra",
    label: "Orthogonality",
    size: 3,
    cohesion: 0.71,
    evidence: ["orthogonal", "perpendicular", "dot product is zero"],
    excluded: ["zero", "vector"],
    notes: [
      "Definition of orthogonal vectors",
      "Orthogonal basis & Gram-Schmidt",
      "Orthogonal complement",
    ],
    related: ["Vector Projections", "Dot Product"],
  },
  "dot-product": {
    id: "dot-product",
    parent: "Mathematics",
    branch: "Linear Algebra",
    label: "Dot Product",
    size: 5,
    cohesion: 0.83,
    evidence: ["scalar product", "dot product", "magnitude", "cos θ"],
    excluded: ["dot", "product", "compon"],
    notes: [
      "Algebraic & geometric definitions",
      "Properties (symmetry, distributivity)",
      "Computing angle between vectors",
      "Cauchy-Schwarz inequality",
      "Connection to projection",
    ],
    related: ["Vector Projections", "Orthogonality"],
  },
  derivatives: {
    id: "derivatives",
    parent: "Mathematics",
    branch: "Calculus",
    label: "Derivatives",
    size: 6,
    cohesion: 0.74,
    evidence: ["instantaneous rate", "limit definition", "tangent line"],
    excluded: ["derivative", "rule"],
    notes: [
      "Limit definition of derivative",
      "Power rule",
      "Product & quotient rules",
      "Chain rule (1-D)",
      "Higher-order derivatives",
      "Implicit differentiation",
    ],
    related: ["Chain Rule"],
  },
  "chain-rule": {
    id: "chain-rule",
    parent: "Mathematics",
    branch: "Calculus",
    label: "Chain Rule",
    size: 4,
    cohesion: 0.81,
    evidence: ["composite function", "outer", "inner", "derivative"],
    excluded: ["chain", "rule"],
    notes: [
      "Statement of the chain rule",
      "Worked: derivative of e^x · sin(x)",
      "Multivariable form (Jacobian)",
      "Applications to physics",
    ],
    related: ["Derivatives"],
  },
  bayes: {
    id: "bayes",
    parent: "Probability",
    branch: "Conditional",
    label: "Bayes' Theorem",
    size: 5,
    cohesion: 0.86,
    evidence: ["prior", "posterior", "likelihood", "P(A|B)"],
    excluded: ["probabl", "event"],
    notes: [
      "Statement of Bayes' theorem",
      "Worked: medical-test false positive",
      "Prior vs. posterior intuition",
      "Bayesian updating",
      "Comparison with frequentist view",
    ],
    related: [],
  },
};

export default function RelationshipsShowcase() {
  const [active, setActive] = useState<string>("vec-proj");
  const cluster = clusters[active];

  return (
    <DemoFrame
      crumbs={[
        { color: "#22b8cf", text: "Calculus II" },
        { text: "relationships", muted: true },
      ]}
      caption="Browse the topic hierarchy your notes form, and see exactly which terms support each cluster — and which were dropped as noise."
    >
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {/* Subjects tree */}
        <div className="p-3 sm:p-4 bg-[#FAFAFA]/50">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            <FolderTree className="h-3 w-3" />
            Subjects
          </div>
          <div className="space-y-1">
            {tree.map((subject) => (
              <SubjectNode
                key={subject.label}
                subject={subject}
                active={active}
                onSelect={setActive}
              />
            ))}
          </div>
        </div>

        {/* Cluster detail */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="p-4 sm:p-5 bg-white space-y-3"
        >
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              {cluster.parent} · {cluster.branch}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                {cluster.label}
              </h3>
              <span className="rounded px-1.5 py-px bg-slate-100 text-[10px] text-slate-600">
                {cluster.size} notes
              </span>
              <span className="text-[10px] text-emerald-600 inline-flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                coh {(cluster.cohesion * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
                <Star className="h-3 w-3" />
                Evidence
              </div>
              <div className="flex flex-wrap gap-1">
                {cluster.evidence.map((t) => (
                  <span
                    key={t}
                    className="text-[10.5px] rounded-full px-2 py-0.5 bg-blue-50 text-[#0061ff] border border-blue-100"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
                <CircleAlert className="h-3 w-3" />
                Dropped as noise
              </div>
              <div className="flex flex-wrap gap-1">
                {cluster.excluded.map((t) => (
                  <span
                    key={t}
                    className="text-[10.5px] rounded-full px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200/70 line-through opacity-80"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
              <Layers className="h-3 w-3" />
              Notes in this cluster
            </div>
            <ul className="space-y-0.5">
              {cluster.notes.map((n) => (
                <li
                  key={n}
                  className="text-[11.5px] text-slate-700 leading-relaxed"
                >
                  · {n}
                </li>
              ))}
            </ul>
          </div>

          {cluster.related.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                Related clusters
              </div>
              <div className="flex flex-wrap gap-1">
                {cluster.related.map((r) => (
                  <span
                    key={r}
                    className="text-[10.5px] rounded-full px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600"
                  >
                    <CircleCheck className="inline h-2.5 w-2.5 mr-1 text-emerald-500" />
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </DemoFrame>
  );
}

function SubjectNode({
  subject,
  active,
  onSelect,
}: {
  subject: {
    label: string;
    children: Array<{
      label: string;
      children?: Array<{ id: string; label: string; size: number }>;
    }>;
  };
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-800 uppercase tracking-wide px-1 py-0.5">
        {subject.label}
      </div>
      <ul className="ml-2 pl-2 border-l border-slate-200 space-y-0.5">
        {subject.children.map((branch) => (
          <li key={branch.label}>
            <div className="text-[10.5px] text-slate-500 px-1 py-0.5 flex items-center gap-1">
              <ChevronDown className="h-2.5 w-2.5" />
              {branch.label}
            </div>
            <ul className="ml-2 pl-2 border-l border-slate-200 space-y-0.5">
              {(branch.children ?? []).map((leaf) => {
                const isActive = active === leaf.id;
                return (
                  <li key={leaf.id}>
                    <button
                      onClick={() => onSelect(leaf.id)}
                      className={`w-full text-left flex items-center justify-between rounded px-1.5 py-1 text-[11px] transition-colors ${
                        isActive
                          ? "bg-blue-50 text-[#0061ff]"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-1 truncate">
                        <ChevronRight
                          className={`h-2.5 w-2.5 transition-transform ${
                            isActive ? "rotate-90" : ""
                          }`}
                        />
                        <span className="truncate font-medium">
                          {leaf.label}
                        </span>
                      </span>
                      <span className="text-[9.5px] tabular-nums text-slate-400">
                        {leaf.size}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
