"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  Sparkles,
  Lightbulb,
  Wand2,
  Send,
  RefreshCw,
  Loader2,
  Link2,
  CircleCheck,
  CircleAlert,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import "katex/dist/katex.min.css";

import type {
  Note,
  Space,
  UnderstandEvaluation,
  UnderstandPack,
  UnderstandQuestion,
  UnderstandQuestionKind,
} from "@/data/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  evaluateAnswer,
  fetchUnderstandPack,
} from "@/lib/understand-client";
import { useEngineUpdates } from "@/lib/engine-events";

const KIND_META: Record<
  UnderstandQuestionKind,
  { label: string; icon: React.ElementType; color: string }
> = {
  explain: {
    label: "Explain in your own words",
    icon: BookOpenCheck,
    color: "text-blue-600 dark:text-blue-400",
  },
  apply: {
    label: "Apply",
    icon: Wand2,
    color: "text-violet-600 dark:text-violet-400",
  },
  connect: {
    label: "Connect",
    icon: Link2,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  example: {
    label: "Invent an example",
    icon: Sparkles,
    color: "text-amber-600 dark:text-amber-400",
  },
};

type LocalState = {
  answer: string;
  hintShown: boolean;
  evaluating: boolean;
  evaluation: UnderstandEvaluation | null;
  error: string | null;
};

const emptyLocal = (): LocalState => ({
  answer: "",
  hintShown: false,
  evaluating: false,
  evaluation: null,
  error: null,
});

export default function SpaceUnderstand({
  focusedSpace,
  userNotes,
  onNoteClick,
}: {
  focusedSpace: Space;
  userNotes: Note[];
  allSpaces?: Space[];
  allNotes?: Note[];
  onNoteClick?: (note: Note) => void;
}) {
  const sortedNotes = useMemo(
    () =>
      [...userNotes].sort((a, b) =>
        (b.last_modified_at ?? b.created_at ?? "").localeCompare(
          a.last_modified_at ?? a.created_at ?? "",
        ),
      ),
    [userNotes],
  );

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    sortedNotes[0]?.id ?? null,
  );
  useEffect(() => {
    if (!selectedNoteId && sortedNotes.length > 0) {
      setSelectedNoteId(sortedNotes[0].id);
    }
  }, [sortedNotes, selectedNoteId]);

  const selectedNote = useMemo(
    () => userNotes.find((n) => n.id === selectedNoteId) ?? null,
    [userNotes, selectedNoteId],
  );

  const [pack, setPack] = useState<UnderstandPack | null>(null);
  const [, setPackCached] = useState(false);
  const [loadingPack, setLoadingPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  // Engine just finished re-analysing this space — note content / cluster
  // siblings may have shifted, so drop any cached pack we already showed.
  useEngineUpdates((d) => {
    if (!d.space_id || d.space_id === focusedSpace.id) {
      setPack(null);
      setPackCached(false);
    }
  });

  // Per-question UI state.
  const [byQ, setByQ] = useState<Record<string, LocalState>>({});

  // Seed from cache on note switch + auto-load.
  useEffect(() => {
    if (!selectedNote) {
      setPack(null);
      setPackCached(false);
      setByQ({});
      return;
    }
    const cached = selectedNote.cache?.understand ?? null;
    if (cached && cached.questions?.length) {
      setPack(cached);
      setPackCached(true);
    } else {
      setPack(null);
      setPackCached(false);
    }
    setByQ({});
    setPackError(null);
  }, [selectedNote?.id, selectedNote?.cache]);

  const generate = useCallback(
    async (force: boolean) => {
      if (!selectedNote) return;
      setLoadingPack(true);
      setPackError(null);
      try {
        const res = await fetchUnderstandPack({
          spaceId: focusedSpace.id,
          noteId: selectedNote.id,
          force,
        });
        if (res.fallback || !res.pack) {
          setPackError(res.detail ?? res.error ?? "Could not generate questions.");
          return;
        }
        setPack(res.pack);
        setPackCached(res.cached);
        setByQ({});
      } catch (err) {
        setPackError(err instanceof Error ? err.message : "Failed");
      } finally {
        setLoadingPack(false);
      }
    },
    [focusedSpace.id, selectedNote],
  );

  // Auto-load if no pack yet (kicks off the first generate per note).
  useEffect(() => {
    if (!selectedNote) return;
    if (pack) return;
    if (loadingPack) return;
    void generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote?.id]);

  const updateLocal = (qid: string, patch: Partial<LocalState>) =>
    setByQ((prev) => ({
      ...prev,
      [qid]: { ...(prev[qid] ?? emptyLocal()), ...patch },
    }));

  const onCheck = async (q: UnderstandQuestion) => {
    if (!selectedNote) return;
    const local = byQ[q.id] ?? emptyLocal();
    if (local.answer.trim().length === 0) {
      updateLocal(q.id, { error: "Write something first." });
      return;
    }
    updateLocal(q.id, { evaluating: true, error: null });
    try {
      const evaluation = await evaluateAnswer({
        spaceId: focusedSpace.id,
        noteId: selectedNote.id,
        questionId: q.id,
        answer: local.answer,
      });
      updateLocal(q.id, {
        evaluating: false,
        evaluation,
        error: evaluation ? null : "Evaluation failed.",
      });
    } catch (err) {
      updateLocal(q.id, {
        evaluating: false,
        error: err instanceof Error ? err.message : "Evaluation failed",
      });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100/80 dark:border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: focusedSpace.color }}
          />
          <h1 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {focusedSpace.name}
          </h1>
          <span className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-medium">
            understand
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs gap-1.5"
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                {selectedNote ? selectedNote.title : "Pick a note"}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[320px] overflow-y-auto">
              {sortedNotes.length === 0 ? (
                <DropdownMenuItem disabled>No notes</DropdownMenuItem>
              ) : (
                sortedNotes.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    onClick={() => setSelectedNoteId(n.id)}
                    className="text-xs"
                  >
                    <span className="truncate">
                      {n.title || "Untitled Note"}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1.5"
            disabled={!selectedNote || loadingPack}
            onClick={() => generate(true)}
            title="Regenerate the question set for this note"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingPack ? "animate-spin" : ""}`}
            />
            Regenerate
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          {!selectedNote ? (
            <Empty
              icon={BookOpenCheck}
              title="Pick a note"
              body="Choose a note above to generate understanding questions."
            />
          ) : loadingPack && !pack ? (
            <Empty
              icon={Loader2}
              title="Generating questions…"
              body={`Reading "${selectedNote.title}" and connecting it to similar notes.`}
              spinning
            />
          ) : packError && !pack ? (
            <div className="rounded-lg border border-red-200/60 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              Couldn&apos;t generate questions: {packError}
            </div>
          ) : !pack || pack.questions.length === 0 ? (
            <Empty
              icon={BookOpenCheck}
              title="Nothing to ask yet"
              body="This note seems empty or too short. Add some content and try again."
            />
          ) : (
            <>
              <div className="flex items-center">
                <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {pack.questions.length} question
                  {pack.questions.length === 1 ? "" : "s"} on{" "}
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">
                    {selectedNote.title}
                  </span>
                </div>
              </div>

              {pack.questions.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  index={idx + 1}
                  question={q}
                  pack={pack}
                  notes={userNotes}
                  local={byQ[q.id] ?? emptyLocal()}
                  onChange={(patch) => updateLocal(q.id, patch)}
                  onCheck={() => onCheck(q)}
                  onNoteClick={onNoteClick}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  index,
  question,
  notes,
  local,
  onChange,
  onCheck,
  onNoteClick,
}: {
  index: number;
  question: UnderstandQuestion;
  pack: UnderstandPack;
  notes: Note[];
  local: LocalState;
  onChange: (patch: Partial<LocalState>) => void;
  onCheck: () => void;
  onNoteClick?: (note: Note) => void;
}) {
  const meta = KIND_META[question.kind];
  const Icon = meta.icon;

  const relatedNotes = (question.related_note_ids ?? [])
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is Note => Boolean(n));

  return (
    <div className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden glow-border">
      <div className="px-4 py-3 border-b border-gray-100/80 dark:border-zinc-800 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 ${meta.color}`}>
          <Icon className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-wide font-medium">
            {index}. {meta.label}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="text-sm text-zinc-800 dark:text-zinc-100 leading-relaxed">
          <ProseMd text={question.prompt} />
        </div>

        {relatedNotes.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
            <span className="text-zinc-400 dark:text-zinc-500">connect to:</span>
            {relatedNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => onNoteClick?.(n)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                title={`Open ${n.title}`}
              >
                <Link2 className="h-2.5 w-2.5" />
                {n.title || "Untitled"}
              </button>
            ))}
          </div>
        )}

        {question.hint && (
          <div>
            {!local.hintShown ? (
              <button
                onClick={() => onChange({ hintShown: true })}
                className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 inline-flex items-center gap-1"
              >
                <Lightbulb className="h-3 w-3" />
                Show hint
              </button>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
                <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
                  <ProseMd text={question.hint} />
                </div>
              </div>
            )}
          </div>
        )}

        <Textarea
          value={local.answer}
          onChange={(e) => onChange({ answer: e.target.value, evaluation: null })}
          placeholder="Write your answer in your own words…"
          className="text-sm min-h-[110px] resize-y border-gray-100/80 dark:border-zinc-700"
          disabled={local.evaluating}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {local.answer.trim().length} char
            {local.answer.trim().length === 1 ? "" : "s"}
          </div>
          <Button
            size="sm"
            onClick={onCheck}
            disabled={local.evaluating || local.answer.trim().length === 0}
            className="h-7 text-xs gap-1.5"
          >
            {local.evaluating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <Send className="h-3 w-3" />
                Check my answer
              </>
            )}
          </Button>
        </div>

        {local.error && (
          <div className="text-[11px] text-red-600 dark:text-red-400">
            {local.error}
          </div>
        )}

        {local.evaluation && (
          <EvaluationCard evaluation={local.evaluation} />
        )}
      </div>
    </div>
  );
}

function EvaluationCard({ evaluation }: { evaluation: UnderstandEvaluation }) {
  const score = Math.max(0, Math.min(1, evaluation.score));
  const pct = Math.round(score * 100);
  const tone =
    score >= 0.8
      ? "emerald"
      : score >= 0.5
        ? "amber"
        : "rose";
  const toneClasses: Record<string, string> = {
    emerald:
      "border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200",
    amber:
      "border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200",
    rose:
      "border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200",
  };
  const barColor: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div
      className={`rounded-md border px-3 py-2.5 space-y-2 ${toneClasses[tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wide font-medium">
          Feedback
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-20 h-1 rounded-full bg-zinc-200/60 dark:bg-zinc-700/60 overflow-hidden">
            <div
              className={`h-full ${barColor[tone]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono">{pct}%</span>
        </div>
      </div>
      <div className="text-[12px] leading-relaxed">
        <ProseMd text={evaluation.feedback} />
      </div>
      {(evaluation.hits.length > 0 || evaluation.misses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {evaluation.hits.length > 0 && (
            <ul className="space-y-0.5">
              {evaluation.hits.map((h, i) => (
                <li key={i} className="flex items-start gap-1 text-[11px]">
                  <CircleCheck className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
          {evaluation.misses.length > 0 && (
            <ul className="space-y-0.5">
              {evaluation.misses.map((m, i) => (
                <li key={i} className="flex items-start gap-1 text-[11px]">
                  <CircleAlert className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ProseMd({ text }: { text: string }) {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none text-sm break-words prose-p:my-1 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSanitize, rehypeKatex]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  body,
  spinning = false,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  spinning?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gray-100/80 dark:border-zinc-700 px-6 py-10 text-center">
      <Icon
        className={`h-5 w-5 text-zinc-400 dark:text-zinc-500 mx-auto mb-2 ${
          spinning ? "animate-spin" : ""
        }`}
      />
      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {title}
      </div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
        {body}
      </div>
    </div>
  );
}
