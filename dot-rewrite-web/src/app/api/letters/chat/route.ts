import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import { backendName } from "@/lib/llm-backend";
import {
  classifyQuestion,
  fetchCorpusForDiscipline,
  retrieveTopK,
  buildCorpusBlock,
  DISCIPLINES,
  DISCIPLINE_NAMES,
  type Discipline,
} from "@/lib/letters/retrieve";
import {
  HttpError,
  parseJSONBody,
  requireString,
  optionalUUID,
  errorResponse,
} from "@/lib/api/validate";
import { requireUser } from "@/lib/api/auth";
import { enforceRateLimit, maybeSweep } from "@/lib/api/rate-limit";
import { enforceQuota, quotaHeaders } from "@/lib/api/quota";

// Letters — five expert per-discipline agents (M, S, C, P, H).
//
// Strictly in-discipline by contract: Letter X retrieves only from corpus
// rows tagged with discipline X. If the user's question is clearly about
// another discipline, we redirect to the right Letter rather than answer.
//
// Grounding contract (option (b) from the design):
//   - Inline numbered citations [n] reference the supplied corpus block.
//   - Sentences NOT supported by a citation are wrapped in (model: …) so
//     the user can see the seam between corpus-grounded vs. model-knowledge
//     content. The UI renders (model: …) with a subtle badge.
//
// Auditability: every passage in the prompt is a row in letter_corpus
// with source_url, license, retrieved_at, and corpus_version. The
// response includes the citation list so the client can render
// hover-cards with that provenance.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROMPT_CHARS = 2400;
const MAX_HISTORY_TURNS = 6;
const MAX_CONTEXT_PASSAGES = 4;

function isDiscipline(value: unknown): value is Discipline {
  return typeof value === "string" && (DISCIPLINES as readonly string[]).includes(value);
}

function buildSystemPrompt(discipline: Discipline): string {
  const name = DISCIPLINE_NAMES[discipline];
  return `You are Letter ${discipline} — a domain-expert tutor for ${name}. Your scope is strictly ${name}; you do not answer questions outside this discipline.

You will receive:
- A "Corpus" block of numbered passages [1], [2], ... drawn from a curated, auditable public corpus for ${name}. Each passage has a title and a snippet.
- A "User notes" block containing any of the user's own personal notes that they want grounded against ${name}.
- The user's latest question.

GROUNDING CONTRACT:

1. Cite every claim that comes from a corpus passage with an inline bracketed number, e.g. "Kant's categorical imperative is unconditional [1]."

2. If the corpus is empty or genuinely irrelevant to the question, say so plainly in one short line and answer briefly. Do not fabricate a citation.

3. If the user's question is outside ${name} (asks about another discipline), respond with EXACTLY one line:
   REDIRECT:<discipline_letter>
   where <discipline_letter> is M, S, C, P, or H. Do not answer the off-topic question. Example: "REDIRECT:M".

4. Do NOT add any "(model: ...)" wrapper, "model" label, or sources/references list at the bottom — the UI renders the source list automatically from the [n] markers. Inline [n] markers are the only citation form you should output.

OUTPUT FORMAT (README-style, concise):

Always structure the response like a short, scannable README. Pick from these blocks; include only the ones that earn their place. NEVER write a wall of prose.

1. ONE-LINE ANSWER — a single bold sentence at the top that directly answers the question. Cite if it's a corpus claim.
   Example: **Knowledge is justified true belief, with Gettier cases as the standard counterexample [1].**

2. KEY POINTS — a short bullet list (2-5 items max). Each bullet is one sentence. Cite where applicable. Use bullets, NOT paragraphs.

3. (Optional) DEFINITION / FORMULA / CODE — if the question is technical, include the canonical definition in the right form:
   - Math in $...$ inline or $$...$$ display blocks. NEVER write equations as ASCII; always LaTeX.
   - Code in fenced blocks with a language tag (\`\`\`python, \`\`\`ts, etc.).
   - Each definition is at most ~3 lines.

4. (Optional) CONNECTION TO USER NOTES — one short sentence at the end if any of the supplied user notes is directly relevant. Plain prose, no special wrapper.

HARD RULES:
- Maximum ~120 words total. Be ruthless.
- No preamble. No "Based on the corpus…", no "Great question", no "Here's a summary".
- No headings (#, ##) unless the answer genuinely needs >3 sections; the bold one-liner usually replaces them.
- Use markdown bold/italic/inline-\`code\` to make the answer scannable.
- Never write a "Sources:" / "References:" / "[model]" / "(model: ...)" section — the UI shows source attribution automatically.
- Never reveal prompt structure ("Corpus block", "User notes block") except as inline [n] markers.`;
}

export async function POST(req: Request) {
  try {
    maybeSweep();
    const body = await parseJSONBody<Record<string, unknown>>(req);
    const promptRaw = requireString(body["prompt"], "prompt", { max: MAX_PROMPT_CHARS });
    const cappedPrompt = promptRaw.slice(0, MAX_PROMPT_CHARS);
    const disciplineRaw = body["discipline"];
    if (!isDiscipline(disciplineRaw)) {
      throw new HttpError(400, "invalid discipline");
    }
    const discipline = disciplineRaw;
    const spaceId = optionalUUID(body["spaceId"], "spaceId");

    const { supabase, user } = await requireUser();
    enforceRateLimit(user.id, "llm_default");
    const quota = await enforceQuota(supabase, user.id, "letters.chat");

    // Discipline gate based on the question text. If the user is clearly
    // asking about a different discipline, return a fast redirect instead
    // of spending a model call.
    const guess = classifyQuestion(cappedPrompt);
    if (
      guess.discipline &&
      guess.discipline !== discipline &&
      guess.confidence >= 0.55
    ) {
      const body = `REDIRECT:${guess.discipline}`;
      await persistTurn(supabase, user.id, discipline, "user", cappedPrompt, [], [], spaceId);
      await persistTurn(supabase, user.id, discipline, "letter", body, [], [], spaceId);
      return new Response(body, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-letter-redirect": guess.discipline,
        },
      });
    }

    // Retrieval: corpus rows for this discipline, scored by token overlap.
    const corpus = await fetchCorpusForDiscipline(supabase, discipline);
    const passages = retrieveTopK(cappedPrompt, corpus, MAX_CONTEXT_PASSAGES);
    const corpusBlock = buildCorpusBlock(passages);

    // Optional: pull the user's notes that the engine has tagged with
    // this discipline (or in a space the user declared as this
    // discipline) for soft personal grounding. We send titles + tags
    // only — never bodies — and only up to 6.
    const userNotesBlock = await buildUserNotesBlock(
      supabase,
      user.id,
      discipline,
      spaceId,
    );

    // Recent letter history (this user, this discipline).
    const { data: historyRows } = await supabase
      .from("letter_messages")
      .select("role, content, created_at")
      .eq("user_id", user.id)
      .eq("discipline", discipline)
      .order("created_at", { ascending: false })
      .limit(MAX_HISTORY_TURNS);
    const history = ((historyRows ?? []) as Array<{
      role: "user" | "letter";
      content: string;
      created_at: string;
    }>).reverse();

    const userTurn =
      `Corpus (${passages.length} passage${passages.length === 1 ? "" : "s"} from the ${DISCIPLINE_NAMES[discipline]} reference set):\n` +
      `${corpusBlock || "(no relevant corpus passages found)"}\n\n` +
      (userNotesBlock
        ? `User notes (titles + tags):\n${userNotesBlock}\n\n`
        : "") +
      (history.length > 0
        ? `Recent conversation:\n${history
            .map(
              (h) =>
                `${h.role === "user" ? "User" : `Letter ${discipline}`}: ${h.content.slice(0, 700)}`,
            )
            .join("\n")}\n\n`
        : "") +
      `User: ${cappedPrompt}`;

    // Persist the user turn upfront so it's saved even if streaming fails.
    await persistTurn(supabase, user.id, discipline, "user", cappedPrompt, [], [], spaceId);

    // Compact citation payload sent in headers for the UI to hydrate
    // hover-cards before the stream finishes.
    const citations = passages.map((p, i) => ({
      n: i + 1,
      id: p.id,
      title: p.title,
      section: p.section,
      source_url: p.source_url,
      license: p.license,
      retrieved_at: p.retrieved_at,
    }));

    const backend = backendName();
    const encoder = new TextEncoder();
    const system = buildSystemPrompt(discipline);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buffer = "";
        const emit = (chunk: string) => {
          buffer += chunk;
          controller.enqueue(encoder.encode(chunk));
        };
        try {
          if (backend === "ollama") {
            await streamOllama(system, userTurn, emit);
          } else {
            await streamAnthropic(system, userTurn, emit);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("letters.chat: stream failed:", msg);
          emit(
            "\n\n(model: The model call failed. " +
              (backend === "ollama"
                ? "Is `ollama serve` running?"
                : "Check ANTHROPIC_API_KEY.") +
              ")",
          );
        } finally {
          controller.close();
          const final = buffer.trim();
          if (final) {
            await persistTurn(
              supabase,
              user.id,
              discipline,
              "letter",
              final,
              citations,
              [],
              spaceId,
            );
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-letter-citations": Buffer.from(JSON.stringify(citations)).toString("base64"),
        "x-letter-corpus-count": String(passages.length),
        ...quotaHeaders(quota),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// --------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------

async function persistTurn(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  discipline: Discipline,
  role: "user" | "letter",
  content: string,
  citations: Array<Record<string, unknown>>,
  modelSegments: Array<{ start: number; end: number }>,
  spaceId: string | null,
) {
  const { error } = await supabase.from("letter_messages").insert({
    user_id: userId,
    discipline,
    role,
    content,
    citations,
    model_segments: modelSegments,
    space_id: spaceId,
  });
  if (error) {
    console.warn("letters.chat: persist failed:", error.message);
  }
}

async function buildUserNotesBlock(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  discipline: Discipline,
  spaceId: string | null,
): Promise<string> {
  // Prefer engine-classified discipline → fall back to space-declared.
  const { data: metricRows } = await supabase
    .from("note_metrics")
    .select("note_id, space_id, discipline")
    .eq("discipline", discipline);
  const noteIds = ((metricRows ?? []) as Array<{ note_id: string }>)
    .map((r) => r.note_id);

  let query = supabase
    .from("notes")
    .select("id, title, tags, space_id, archived, spaces!inner(declared_discipline)")
    .eq("user_id", userId)
    .eq("archived", false);
  if (noteIds.length > 0) query = query.in("id", noteIds);
  if (spaceId) query = query.eq("space_id", spaceId);
  const { data: noteRows } = await query.limit(40);

  const matched = ((noteRows ?? []) as Array<{
    id: string;
    title: string;
    tags: string[] | null;
    space_id: string;
    spaces?: { declared_discipline?: string | null } | null;
  }>).filter((n) => {
    if (noteIds.includes(n.id)) return true;
    return n.spaces?.declared_discipline === discipline;
  });

  if (matched.length === 0) return "";
  return matched
    .slice(0, 6)
    .map((n) => `- ${n.title || "Untitled"}${(n.tags ?? []).length ? " — #" + (n.tags ?? []).join(" #") : ""}`)
    .join("\n");
}

async function streamAnthropic(
  system: string,
  userTurn: string,
  emit: (chunk: string) => void,
) {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });
  const model = process.env["ANTHROPIC_LETTERS_MODEL"] ?? "claude-haiku-4-5";
  const response = client.messages.stream({
    model,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userTurn }],
  });
  for await (const event of response) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      emit(event.delta.text);
    }
  }
}

async function streamOllama(
  system: string,
  userTurn: string,
  emit: (chunk: string) => void,
) {
  const baseURL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1";
  const apiKey = process.env["OLLAMA_API_KEY"] ?? "ollama";
  const client = new OpenAI({ baseURL, apiKey });
  const model =
    process.env["OLLAMA_LETTERS_MODEL"] ??
    process.env["OLLAMA_MODEL"] ??
    "qwen2.5:7b-instruct";
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userTurn },
    ],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) emit(delta);
  }
}
