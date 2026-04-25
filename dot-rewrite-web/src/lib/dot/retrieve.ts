import type { Note, SemanticClusterRow } from "@/data/types";

// Lightweight retrieval for Dot. We do NOT re-embed the question — that
// would require running sentence-transformers in Node. Instead we score
// candidates by token overlap against what the engine has already
// distilled about each note: title, TL;DR summary (notes.cache.summary),
// tags, and the semantic cluster's label + keywords.
//
// With summaries already in the DB, overlap-on-summaries is a strong
// retrieval signal and keeps the prompt small — no full note bodies go
// to the LLM. For a space with 100 notes this runs in well under a ms.

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "so",
  "some",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "up",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "why",
  "will",
  "with",
  "you",
  "your",
  "yours",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "about",
  "tell",
  "show",
  "give",
  "find",
  "note",
  "notes",
]);

const WORD_RE = /[a-z0-9][a-z0-9\-_]*/g;

export function tokenize(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const m of lower.matchAll(WORD_RE)) {
    const tok = m[0];
    if (tok.length <= 1) continue;
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

export type RetrievalCandidate = {
  note: Note;
  cluster: SemanticClusterRow | null;
  score: number;
  matchedTerms: string[];
};

function summaryOf(n: Note): string {
  const c = n.cache;
  return typeof c?.summary === "string" ? c.summary : "";
}

function scoreNote(
  qTokens: Set<string>,
  note: Note,
  clusterByNote: Map<string, SemanticClusterRow>,
): { score: number; matched: string[] } {
  if (qTokens.size === 0) return { score: 0, matched: [] };
  const cluster = clusterByNote.get(note.id) ?? null;
  const title = tokenize(note.title);
  const summary = tokenize(summaryOf(note));
  const tags = (note.tags ?? []).map((t) => t.toLowerCase());
  const clusterTokens: string[] = cluster
    ? [
        ...tokenize(cluster.label ?? ""),
        ...(cluster.keywords ?? []).flatMap((k) => tokenize(k)),
        ...(cluster.parent_topic ? tokenize(cluster.parent_topic) : []),
      ]
    : [];

  const matched: string[] = [];
  let score = 0;

  const bump = (tokens: string[], weight: number) => {
    const seen = new Set<string>();
    for (const t of tokens) {
      if (!qTokens.has(t)) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      score += weight;
      if (matched.length < 8) matched.push(t);
    }
  };

  bump(title, 3);
  bump(summary, 2);
  bump(clusterTokens, 2);
  bump(tags, 2);

  return { score, matched };
}

export function retrieveTopK(args: {
  question: string;
  notes: Note[];
  clusters: SemanticClusterRow[];
  k?: number;
  focusedNoteId?: string | null;
}): RetrievalCandidate[] {
  const k = args.k ?? 6;
  const qTokens = new Set(tokenize(args.question));

  // Map each note to its first matching semantic cluster for labeling.
  const clusterByNote = new Map<string, SemanticClusterRow>();
  for (const c of args.clusters) {
    for (const nid of c.note_ids ?? []) {
      if (!clusterByNote.has(nid)) clusterByNote.set(nid, c);
    }
  }

  const scored: RetrievalCandidate[] = args.notes
    .map((note) => {
      const { score, matched } = scoreNote(qTokens, note, clusterByNote);
      return {
        note,
        cluster: clusterByNote.get(note.id) ?? null,
        score,
        matchedTerms: matched,
      };
    })
    .filter((c) => c.score > 0);

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);

  // Always include the focused note (if any) as the first candidate, even
  // if it didn't score. Matches the Dot UI's "focus on this note" dropdown.
  if (args.focusedNoteId) {
    const focused = args.notes.find((n) => n.id === args.focusedNoteId);
    if (focused && !top.some((c) => c.note.id === focused.id)) {
      top.unshift({
        note: focused,
        cluster: clusterByNote.get(focused.id) ?? null,
        score: 0,
        matchedTerms: [],
      });
      top.length = Math.min(top.length, k + 1);
    }
  }

  // If the question matched nothing (e.g. very short "hi") fall back to
  // the most-recent notes so Dot has *something* to ground on instead of
  // pretending the space is empty.
  if (top.length === 0) {
    const recent = [...args.notes]
      .sort((a, b) => {
        const aT = a.last_modified_at ?? a.created_at ?? "";
        const bT = b.last_modified_at ?? b.created_at ?? "";
        return bT.localeCompare(aT);
      })
      .slice(0, Math.min(k, 4));
    return recent.map((note) => ({
      note,
      cluster: clusterByNote.get(note.id) ?? null,
      score: 0,
      matchedTerms: [],
    }));
  }

  return top;
}

export function buildNoteContextBlock(
  candidates: RetrievalCandidate[],
  opts: { maxSummaryChars?: number } = {},
): string {
  const maxSummary = opts.maxSummaryChars ?? 360;
  const lines: string[] = [];
  for (const c of candidates) {
    const title = c.note.title || "Untitled";
    const cluster = c.cluster?.label ?? c.cluster?.parent_topic ?? null;
    const tags = (c.note.tags ?? []).slice(0, 4).join(", ");
    const summary = summaryOf(c.note) ||
      (c.note.content ?? "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/[#*_`>~-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxSummary);
    const s = summary.length > maxSummary ? summary.slice(0, maxSummary - 1) + "…" : summary;
    lines.push(
      `- [${c.note.id}] ${title}${cluster ? ` (${cluster})` : ""}${
        tags ? ` — tags: ${tags}` : ""
      }\n  ${s}`,
    );
  }
  return lines.join("\n");
}
