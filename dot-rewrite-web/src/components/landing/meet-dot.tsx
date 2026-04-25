"use client";

import {
  ArrowRight,
  ChevronDown,
  Sparkles,
  Files,
  Send,
  Link2,
  Timer,
} from "lucide-react";

import { DemoFrame } from "./demo-frame";

const EXAMPLES = [
  "What did Prof. Smith cover on epsilon-delta limits?",
  "Find common themes across my derivatives notes.",
  "Compare projections and orthogonality in my own words.",
];

const QUESTION =
  "What's the relationship between dot product and projections in my notes?";

const RESPONSE_LINES: Array<
  | { kind: "p"; html: string }
  | { kind: "math"; body: string }
> = [
  {
    kind: "p",
    html:
      'From <a class="note-cite">Vector Projections</a> and <a class="note-cite">Dot Product</a>, the projection of $\\vec{a}$ onto $\\vec{b}$ uses the dot product to measure how much of $\\vec{a}$ aligns with $\\vec{b}$:',
  },
  { kind: "math", body: "proj_b a = (a · b / b · b) b" },
  {
    kind: "p",
    html:
      'So the dot product is the <strong>scalar gear</strong> that scales $\\vec{b}$ to land along $\\vec{a}$’s shadow on it. <a class="note-cite">Orthogonality</a> covers the case where this scalar is zero.',
  },
];

const CITED = ["Vector Projections", "Dot Product", "Orthogonality"];

function inline(html: string): string {
  return html
    .replace(
      /<a class="note-cite">([^<]+)<\/a>/g,
      '<span class="rounded px-1 py-px bg-blue-50 text-[#0061ff] border border-blue-100 font-medium">$1</span>',
    )
    .replace(
      /\$([^$]+)\$/g,
      '<span class="font-mono text-[0.9em] text-slate-800">$1</span>',
    )
    .replace(/<strong>/g, '<strong class="font-medium text-slate-900">');
}

export default function MeetDot() {
  return (
    <DemoFrame
      crumbs={[
        { color: "#22b8cf", text: "Calculus II" },
        { text: "dot", muted: true },
      ]}
      rightChip={
        <>
          <Timer className="h-3 w-3" />
          <span className="font-mono">~8s avg</span>
        </>
      }
      caption="A scaled-down preview of the real Dot tab. Same input and output layout you'll use inside every space."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="p-4 sm:p-5 space-y-3 bg-[#FAFAFA]/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">
              Input
            </span>
            <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
              <Files className="h-3 w-3" />
              History
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-slate-600">
                Focused on
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 rounded-md border border-slate-200 px-2 py-0.5 bg-white">
                All Notes
                <ChevronDown className="h-3 w-3 opacity-60" />
              </span>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1.5">
                Try
              </div>
              <ul className="space-y-1 mb-3">
                {EXAMPLES.map((ex, i) => (
                  <li
                    key={i}
                    className={`text-[11px] truncate px-2 py-1 rounded ${
                      i === 0
                        ? "bg-blue-50/70 text-[#0061ff] border border-blue-100"
                        : "text-slate-500"
                    }`}
                  >
                    · {ex}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50/40 p-2.5 text-[12px] leading-relaxed text-slate-800">
              {QUESTION}
              <span className="ml-0.5 inline-block w-px h-3 align-middle bg-slate-400 animate-pulse" />
            </div>

            <div className="flex items-center justify-end pt-0.5">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#0061ff] text-white text-[11px] font-medium px-2.5 py-1 shadow-sm">
                Submit
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-slate-200 px-3 py-2 text-[10px] text-slate-500 leading-relaxed flex items-start gap-2">
            <Sparkles className="h-3 w-3 text-[#0061ff] flex-shrink-0 mt-0.5" />
            <span>
              Dot reads only the notes inside this space and cites the ones
              it pulled from.
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500">
              Output
            </span>
            <span className="text-[10px] text-emerald-600 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              grounded in 4 notes
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3 text-[12.5px] leading-relaxed text-slate-700 min-h-[180px]">
            {RESPONSE_LINES.map((line, i) =>
              line.kind === "math" ? (
                <div
                  key={i}
                  className="rounded-md bg-slate-50 border border-slate-100 px-3 py-2 font-mono text-[12px] text-slate-800"
                >
                  {line.body}
                </div>
              ) : (
                <p
                  key={i}
                  dangerouslySetInnerHTML={{ __html: inline(line.html) }}
                />
              ),
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 mr-1">
              Cited
            </span>
            {CITED.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 text-[10.5px] rounded-full px-2 py-0.5 bg-blue-50 text-[#0061ff] border border-blue-100"
              >
                <Link2 className="h-2.5 w-2.5" />
                {c}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-end pt-1">
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
              <Send className="h-3 w-3" />
              Streaming…
            </span>
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}
