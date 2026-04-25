"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  GraduationCap,
  Timer,
  Send,
  Loader2,
  AlertTriangle,
  Trophy,
  CircleCheck,
  CircleAlert,
  RotateCcw,
  Play,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize from "rehype-sanitize";
import "katex/dist/katex.min.css";

import type {
  ExamEvaluation,
  ExamQuestion,
  Note,
  Space,
} from "@/data/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchActiveExam, startExam, submitExam } from "@/lib/exam-client";

type Phase = "setup" | "running" | "submitting" | "graded";

const DURATION_PRESETS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
  { label: "60 min", seconds: 3600 },
];
const QUESTION_COUNT_PRESETS = [3, 5, 8, 12];

function formatTime(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SpaceExam({
  focusedSpace,
  userNotes,
  onActiveChange,
}: {
  focusedSpace: Space;
  userNotes: Note[];
  allSpaces?: Space[];
  allNotes?: Note[];
  onActiveChange?: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(userNotes.map((n) => n.id)),
  );
  const [questionCount, setQuestionCount] = useState(5);
  const [durationSeconds, setDurationSeconds] = useState(1800);

  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<
    Array<Omit<ExamQuestion, "reference">>
  >([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState<number>(0);
  const [duration, setDuration] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [evaluation, setEvaluation] = useState<ExamEvaluation | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submittingRef = useRef(false);

  // Notify parent so it can lock dashboard navigation while running.
  useEffect(() => {
    onActiveChange?.(phase === "running" || phase === "submitting");
  }, [phase, onActiveChange]);

  // Resume an in-flight exam if the page was reloaded mid-session. Runs
  // once per space; the GET endpoint strips private rubrics.
  useEffect(() => {
    if (phase !== "setup") return;
    let cancelled = false;
    (async () => {
      try {
        const { session } = await fetchActiveExam(focusedSpace.id);
        if (cancelled || !session) return;
        if (session.expired) {
          // The browser was closed past the deadline. Auto-submit so the
          // user gets *some* grade rather than a frozen "active" row.
          setSessionId(session.id);
          setQuestions(session.questions);
          setAnswers(session.answers ?? {});
          setDuration(session.duration_seconds);
          setStartedAt(new Date(session.started_at).getTime());
          setNow(Date.now());
          setPhase("running");
          // Yield so React commits state, then auto-submit.
          setTimeout(() => {
            void submitExam({
              sessionId: session.id,
              answers: session.answers ?? {},
              autoSubmitted: true,
            })
              .then(({ evaluation }) => {
                if (!cancelled) {
                  setEvaluation(evaluation);
                  setPhase("graded");
                }
              })
              .catch(() => {
                if (!cancelled) setPhase("setup");
              });
          }, 0);
          return;
        }
        // Live exam: restore state and resume.
        setSessionId(session.id);
        setQuestions(session.questions);
        setAnswers(session.answers ?? {});
        setDuration(session.duration_seconds);
        setStartedAt(new Date(session.started_at).getTime());
        setNow(Date.now());
        setPhase("running");
      } catch {
        // No active session, or fetch failed — stay in setup view.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedSpace.id]);

  // Tick once a second when running.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const remaining = useMemo(() => {
    if (phase !== "running") return 0;
    return Math.max(0, duration - Math.floor((now - startedAt) / 1000));
  }, [phase, duration, now, startedAt]);

  // Block accidental tab close / refresh while running.
  useEffect(() => {
    if (phase !== "running") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "Your exam is still in progress. Leaving will discard your answers.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const finishExam = useCallback(
    async (auto: boolean) => {
      if (submittingRef.current || !sessionId) return;
      submittingRef.current = true;
      setPhase("submitting");
      setSubmitError(null);
      try {
        const { evaluation } = await submitExam({
          sessionId,
          answers,
          autoSubmitted: auto,
        });
        setEvaluation(evaluation);
        setPhase("graded");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed");
        setPhase("running");
      } finally {
        submittingRef.current = false;
      }
    },
    [sessionId, answers],
  );

  // Auto-submit when timer hits zero.
  useEffect(() => {
    if (phase === "running" && remaining === 0 && duration > 0) {
      void finishExam(true);
    }
  }, [phase, remaining, duration, finishExam]);

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      const { session } = await startExam({
        spaceId: focusedSpace.id,
        noteIds:
          selectedNoteIds.size > 0
            ? Array.from(selectedNoteIds)
            : undefined,
        questionCount,
        durationSeconds,
      });
      setSessionId(session.id);
      setQuestions(session.questions);
      setAnswers(
        Object.fromEntries(session.questions.map((q) => [q.id, ""])),
      );
      setDuration(session.duration_seconds);
      setStartedAt(new Date(session.started_at).getTime());
      setNow(Date.now());
      setEvaluation(null);
      setPhase("running");
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed");
    } finally {
      setStarting(false);
    }
  };

  const reset = () => {
    setPhase("setup");
    setSessionId(null);
    setQuestions([]);
    setAnswers({});
    setEvaluation(null);
    setStartedAt(0);
    setDuration(0);
    setSubmitError(null);
    setConfirmingSubmit(false);
  };

  const totalPoints =
    questions.reduce((s, q) => s + q.points, 0) ||
    evaluation?.total_points ||
    0;

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
            exam
          </span>
        </div>
        {(phase === "running" || phase === "submitting") && (
          <div
            className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md border ${
              remaining < 60
                ? "border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 bg-rose-50/60 dark:bg-rose-950/20"
                : "border-gray-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
            }`}
            aria-live="polite"
          >
            <Timer className="h-3.5 w-3.5" />
            {formatTime(remaining)}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6">
          {phase === "setup" && (
            <SetupView
              userNotes={userNotes}
              selectedNoteIds={selectedNoteIds}
              setSelectedNoteIds={setSelectedNoteIds}
              questionCount={questionCount}
              setQuestionCount={setQuestionCount}
              durationSeconds={durationSeconds}
              setDurationSeconds={setDurationSeconds}
              starting={starting}
              startError={startError}
              onStart={start}
            />
          )}

          {(phase === "running" || phase === "submitting") && (
            <RunningView
              questions={questions}
              answers={answers}
              setAnswers={setAnswers}
              totalPoints={totalPoints}
              submitting={phase === "submitting"}
              submitError={submitError}
              onRequestSubmit={() => setConfirmingSubmit(true)}
              userNotes={userNotes}
            />
          )}

          {phase === "graded" && evaluation && (
            <GradedView
              evaluation={evaluation}
              questions={questions}
              answers={answers}
              userNotes={userNotes}
              onReset={reset}
            />
          )}
        </div>
      </div>

      {confirmingSubmit && (
        <ConfirmModal
          title="Submit exam?"
          body={
            <div className="text-xs text-zinc-600 dark:text-zinc-300 space-y-1">
              <p>
                You will receive your grade and your answers will be locked.
                You cannot edit answers after submitting.
              </p>
              <p>
                Unanswered questions will count as zero. Time remaining:{" "}
                <span className="font-mono">{formatTime(remaining)}</span>.
              </p>
            </div>
          }
          confirmLabel="Yes, submit"
          cancelLabel="Keep working"
          onConfirm={() => {
            setConfirmingSubmit(false);
            void finishExam(false);
          }}
          onCancel={() => setConfirmingSubmit(false)}
          tone="amber"
        />
      )}
    </div>
  );
}

// -------------------- Setup --------------------

function SetupView({
  userNotes,
  selectedNoteIds,
  setSelectedNoteIds,
  questionCount,
  setQuestionCount,
  durationSeconds,
  setDurationSeconds,
  starting,
  startError,
  onStart,
}: {
  userNotes: Note[];
  selectedNoteIds: Set<string>;
  setSelectedNoteIds: (s: Set<string>) => void;
  questionCount: number;
  setQuestionCount: (n: number) => void;
  durationSeconds: number;
  setDurationSeconds: (n: number) => void;
  starting: boolean;
  startError: string | null;
  onStart: () => void;
}) {
  const allSelected = selectedNoteIds.size === userNotes.length;
  const toggleAll = () => {
    if (allSelected) setSelectedNoteIds(new Set());
    else setSelectedNoteIds(new Set(userNotes.map((n) => n.id)));
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 glow-border">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="h-4 w-4 text-zinc-700 dark:text-zinc-200" />
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            New exam
          </h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
          Generates teacher-style questions strictly from your selected notes.
          Once you start, the timer runs and you can&apos;t leave the page
          without confirming.
        </p>

        {/* Scope */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-semibold">
              Scope
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="rounded-md border border-gray-100/80 dark:border-zinc-800 max-h-[220px] overflow-y-auto divide-y divide-gray-100/60 dark:divide-zinc-800/60">
            {userNotes.length === 0 ? (
              <div className="px-3 py-4 text-[11px] italic text-zinc-400">
                No notes in this space yet.
              </div>
            ) : (
              userNotes.map((n) => {
                const checked = selectedNoteIds.has(n.id);
                return (
                  <label
                    key={n.id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = new Set(selectedNoteIds);
                        if (v) next.add(n.id);
                        else next.delete(n.id);
                        setSelectedNoteIds(next);
                      }}
                    />
                    <span className="text-[12px] text-zinc-700 dark:text-zinc-200 truncate">
                      {n.title || "Untitled Note"}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {selectedNoteIds.size} of {userNotes.length} selected
          </div>
        </div>

        {/* Question count */}
        <div className="space-y-2 mb-5">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-semibold">
            Questions
          </div>
          <div className="flex flex-wrap gap-2">
            {QUESTION_COUNT_PRESETS.map((n) => (
              <PresetButton
                key={n}
                active={questionCount === n}
                onClick={() => setQuestionCount(n)}
              >
                {n}
              </PresetButton>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2 mb-5">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400 font-semibold">
            Duration
          </div>
          <div className="flex flex-wrap gap-2">
            {DURATION_PRESETS.map((p) => (
              <PresetButton
                key={p.seconds}
                active={durationSeconds === p.seconds}
                onClick={() => setDurationSeconds(p.seconds)}
              >
                {p.label}
              </PresetButton>
            ))}
          </div>
        </div>

        {startError && (
          <div className="text-[11px] text-red-600 dark:text-red-400 mb-3">
            {startError}
          </div>
        )}

        <Button
          onClick={onStart}
          disabled={starting || selectedNoteIds.size === 0}
          className="w-full gap-2"
        >
          {starting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Generating questions…
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Start exam
            </>
          )}
        </Button>
      </div>

      <div className="rounded-md border border-dashed border-gray-100/80 dark:border-zinc-700 bg-gray-50/60 dark:bg-zinc-800/30 px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
        <strong className="text-zinc-700 dark:text-zinc-200">
          Strict notes-only:
        </strong>{" "}
        questions and grading are derived only from your selected notes — no
        outside material is introduced.
      </div>
    </div>
  );
}

function PresetButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-md border text-xs transition-colors ${
        active
          ? "border-zinc-800 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900"
          : "border-gray-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

// -------------------- Running --------------------

function RunningView({
  questions,
  answers,
  setAnswers,
  totalPoints,
  submitting,
  submitError,
  onRequestSubmit,
  userNotes,
}: {
  questions: Array<Omit<ExamQuestion, "reference">>;
  answers: Record<string, string>;
  setAnswers: (
    fn: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  totalPoints: number;
  submitting: boolean;
  submitError: string | null;
  onRequestSubmit: () => void;
  userNotes: Note[];
}) {
  const noteById = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of userNotes) m.set(n.id, n);
    return m;
  }, [userNotes]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Closed-book exam in progress. Closing or refreshing this page will
          discard your answers. Auto-submits when the timer hits 0:00.
        </span>
      </div>

      {questions.map((q, i) => {
        const sourceTitles = q.source_note_ids
          .map((id) => noteById.get(id)?.title ?? null)
          .filter(Boolean);
        return (
          <div
            key={q.id}
            className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden glow-border"
          >
            <div className="px-4 py-3 border-b border-gray-100/80 dark:border-zinc-800 flex items-center justify-between text-[10px] uppercase tracking-wide">
              <span className="text-zinc-500 dark:text-zinc-400">
                Q{i + 1} ·{" "}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {q.difficulty}
                </span>
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {q.points} pts
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <ProseMd text={q.prompt} />
              {sourceTitles.length > 0 && (
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  draws on: {sourceTitles.join(", ")}
                </div>
              )}
              <Textarea
                value={answers[q.id] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                placeholder="Your answer…"
                className="text-sm min-h-[140px] resize-y"
                disabled={submitting}
              />
            </div>
          </div>
        );
      })}

      {submitError && (
        <div className="text-[11px] text-red-600 dark:text-red-400">
          {submitError}
        </div>
      )}

      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white/95 dark:from-zinc-950 dark:via-zinc-950/95 pt-3 pb-2 -mx-6 px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {questions.length} question{questions.length === 1 ? "" : "s"} ·{" "}
            {totalPoints} pts total
          </div>
          <Button
            size="sm"
            onClick={onRequestSubmit}
            disabled={submitting}
            className="gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Grading…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Submit exam
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// -------------------- Graded --------------------

function GradedView({
  evaluation,
  questions,
  answers,
  userNotes,
  onReset,
}: {
  evaluation: ExamEvaluation;
  questions: Array<Omit<ExamQuestion, "reference">>;
  answers: Record<string, string>;
  userNotes: Note[];
  onReset: () => void;
}) {
  const pct =
    evaluation.total_points === 0
      ? 0
      : Math.round((evaluation.earned_points / evaluation.total_points) * 100);
  const tone = pct >= 85 ? "emerald" : pct >= 60 ? "amber" : "rose";
  const toneColors: Record<string, string> = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    rose: "text-rose-700 dark:text-rose-300",
  };
  const noteById = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of userNotes) m.set(n.id, n);
    return m;
  }, [userNotes]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 glow-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Result
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs">
            <RotateCcw className="h-3 w-3" />
            New exam
          </Button>
        </div>
        <div className={`text-3xl font-mono font-medium ${toneColors[tone]}`}>
          {pct}%
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
          {evaluation.earned_points} of {evaluation.total_points} points
        </div>
        {evaluation.overall && (
          <p className="text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-200 mt-3">
            {evaluation.overall}
          </p>
        )}
      </div>

      {questions.map((q, i) => {
        const r = evaluation.per_question.find(
          (x) => x.question_id === q.id,
        );
        if (!r) return null;
        const qPct = Math.round(r.score * 100);
        const qTone = qPct >= 85 ? "emerald" : qPct >= 60 ? "amber" : "rose";
        const sourceTitles = q.source_note_ids
          .map((id) => noteById.get(id)?.title ?? null)
          .filter(Boolean);
        return (
          <div
            key={q.id}
            className="rounded-xl border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden glow-border"
          >
            <div className="px-4 py-3 border-b border-gray-100/80 dark:border-zinc-800 flex items-center justify-between text-[10px] uppercase tracking-wide">
              <span className="text-zinc-500 dark:text-zinc-400">
                Q{i + 1} · {q.difficulty}
              </span>
              <span className={`font-mono ${toneColors[qTone]}`}>
                {r.points_earned} / {q.points} pts
              </span>
            </div>
            <div className="px-4 py-3 space-y-3">
              <ProseMd text={q.prompt} />
              {sourceTitles.length > 0 && (
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  draws on: {sourceTitles.join(", ")}
                </div>
              )}
              <div className="rounded-md bg-gray-50/60 dark:bg-zinc-800/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">
                  Your answer
                </div>
                <p className="text-[12px] whitespace-pre-wrap text-zinc-700 dark:text-zinc-200 break-words">
                  {answers[q.id]?.trim() || (
                    <span className="italic text-zinc-400">
                      No answer provided.
                    </span>
                  )}
                </p>
              </div>
              {r.feedback && (
                <p className="text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-200">
                  {r.feedback}
                </p>
              )}
              {(r.hits.length > 0 || r.misses.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {r.hits.length > 0 && (
                    <ul className="space-y-0.5">
                      {r.hits.map((h, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1 text-[11px] text-emerald-700 dark:text-emerald-300"
                        >
                          <CircleCheck className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.misses.length > 0 && (
                    <ul className="space-y-0.5">
                      {r.misses.map((m, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-1 text-[11px] text-rose-700 dark:text-rose-300"
                        >
                          <CircleAlert className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -------------------- Helpers --------------------

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

function ConfirmModal({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "default",
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "default" | "amber" | "rose";
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900",
    amber:
      "bg-amber-600 hover:bg-amber-700 text-white border-amber-600",
    rose: "bg-rose-600 hover:bg-rose-700 text-white border-rose-600",
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[400px] rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xl">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          {title}
        </h3>
        <div className="mb-4">{body}</div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-xs rounded-md px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`text-xs rounded-md px-3 py-1.5 ${toneClasses[tone]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
