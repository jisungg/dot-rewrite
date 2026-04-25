import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type Discipline = "M" | "S" | "C" | "P" | "H";

export const DISCIPLINES: readonly Discipline[] = ["M", "S", "C", "P", "H"] as const;

export const DISCIPLINE_NAMES: Record<Discipline, string> = {
  M: "Mathematics",
  S: "Sciences",
  C: "Computer Science",
  P: "Philosophy",
  H: "History",
};

export type CorpusRow = {
  id: string;
  discipline: Discipline;
  source_url: string;
  license: string;
  title: string;
  section: string;
  content: string;
  retrieved_at: string;
  corpus_version: string;
};

export type RetrievedPassage = CorpusRow & { score: number };

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "but", "to", "in", "on", "at", "by",
  "for", "with", "as", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "i", "you", "we", "they",
  "he", "she", "him", "her", "them", "us", "my", "your", "their", "our",
  "what", "how", "why", "when", "where", "who", "which", "do", "does", "did",
  "can", "could", "should", "would", "may", "might", "will", "shall",
  "have", "has", "had", "not", "no", "yes", "if", "then", "else", "from",
  "about", "into", "than", "so", "such", "very", "just",
]);

const TOKEN_RE = /[a-zA-Z][a-zA-Z\-]+/g;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(TOKEN_RE) ?? []).filter(
    (t) => t.length >= 3 && !STOPWORDS.has(t),
  );
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

export async function fetchCorpusForDiscipline(
  supabase: SupabaseClient,
  discipline: Discipline,
  corpusVersion = "v1",
): Promise<CorpusRow[]> {
  const { data, error } = await supabase
    .from("letter_corpus")
    .select(
      "id, discipline, source_url, license, title, section, content, retrieved_at, corpus_version",
    )
    .eq("discipline", discipline)
    .eq("corpus_version", corpusVersion);
  if (error) {
    console.error("fetchCorpusForDiscipline:", error.message);
    return [];
  }
  return (data ?? []) as CorpusRow[];
}

/**
 * Lexical retrieval (token-overlap) over the in-memory corpus. The seeded
 * corpus is small enough (tens to low-hundreds of passages per discipline)
 * that this is fast and deterministic. When the corpus grows we can swap
 * in pgvector + the stored embeddings without changing the call sites.
 */
export function retrieveTopK(
  question: string,
  corpus: CorpusRow[],
  k = 4,
): RetrievedPassage[] {
  const qToks = tokenSet(question);
  if (qToks.size === 0 || corpus.length === 0) return [];
  const scored: RetrievedPassage[] = corpus.map((row) => {
    const blob = `${row.title}\n${row.section}\n${row.content}`;
    const dToks = tokenize(blob);
    let hits = 0;
    for (const t of dToks) if (qToks.has(t)) hits += 1;
    // Boost: title hits weighted x3, section x2.
    const titleHits = tokenize(row.title).filter((t) => qToks.has(t)).length;
    const sectionHits = tokenize(row.section).filter((t) => qToks.has(t)).length;
    const score = hits + 2 * sectionHits + 3 * titleHits;
    return { ...row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((p) => p.score > 0).slice(0, k);
}

export function buildCorpusBlock(passages: RetrievedPassage[]): string {
  if (passages.length === 0) return "";
  return passages
    .map((p, i) => {
      const head = `[${i + 1}] ${p.title}${p.section ? ` — ${p.section}` : ""}`;
      const body = p.content.length > 900 ? `${p.content.slice(0, 880)}…` : p.content;
      return `${head}\n${body}`;
    })
    .join("\n\n");
}

/**
 * Cheap discipline gate: classify the question itself by lexical overlap
 * with each discipline's lexicon. Returns the dominant discipline + its
 * confidence (0-1). Used to redirect "this looks like CS — try Letter C".
 */
const LEXICONS: Record<Discipline, Set<string>> = {
  M: new Set([
    "theorem", "proof", "lemma", "matrix", "vector", "eigenvalue",
    "derivative", "integral", "limit", "topology", "polynomial", "calculus",
    "linear", "algebra", "geometry", "discrete", "probability", "set",
    "group", "ring", "field", "function", "equation", "differential",
    "convex", "logarithm", "trigonometry", "isomorphism",
  ]),
  S: new Set([
    "atom", "molecule", "cell", "dna", "rna", "protein", "enzyme",
    "photon", "electron", "quantum", "energy", "force", "mass", "velocity",
    "newton", "ecosystem", "evolution", "species", "organism",
    "photosynthesis", "respiration", "thermodynamics", "entropy",
    "gravity", "relativity", "biology", "chemistry", "physics",
    "reaction", "compound", "isotope", "neuron", "synapse",
  ]),
  C: new Set([
    "algorithm", "complexity", "data", "structure", "array", "tree",
    "graph", "hash", "stack", "queue", "recursion", "binary", "compiler",
    "memory", "cache", "thread", "process", "kernel", "python",
    "javascript", "typescript", "react", "api", "rest", "http", "tcp",
    "database", "sql", "schema", "index", "transaction", "cpu", "gpu",
    "neural", "network", "model", "tensor", "training", "regression",
    "classification",
  ]),
  P: new Set([
    "epistemology", "metaphysics", "ontology", "ethics", "morality",
    "consciousness", "knowledge", "belief", "truth", "kant", "hume",
    "plato", "aristotle", "nietzsche", "wittgenstein", "descartes",
    "phenomenology", "existentialism", "stoicism", "utilitarianism",
    "deontology", "categorical", "imperative", "free", "will",
    "determinism", "qualia", "soul", "mind", "argument", "premise",
    "fallacy", "syllogism", "dialectic",
  ]),
  H: new Set([
    "century", "war", "revolution", "empire", "kingdom", "dynasty",
    "republic", "treaty", "battle", "siege", "monarch", "emperor",
    "renaissance", "enlightenment", "reformation", "industrial",
    "colonial", "constitution", "parliament", "rome", "greece",
    "byzantium", "ottoman", "feudal", "medieval", "ancient",
    "historiography", "civilization",
  ]),
};

export function classifyQuestion(
  question: string,
): { discipline: Discipline | null; confidence: number } {
  const toks = tokenSet(question);
  if (toks.size === 0) return { discipline: null, confidence: 0 };
  const scores: Record<Discipline, number> = { M: 0, S: 0, C: 0, P: 0, H: 0 };
  for (const d of DISCIPLINES) {
    for (const t of toks) if (LEXICONS[d].has(t)) scores[d] += 1;
  }
  let best: Discipline | null = null;
  let bestScore = 0;
  for (const d of DISCIPLINES) {
    if (scores[d] > bestScore) {
      bestScore = scores[d];
      best = d;
    }
  }
  if (!best || bestScore === 0) return { discipline: null, confidence: 0 };
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  return { discipline: best, confidence: Math.min(1, bestScore / total + 0.2) };
}
