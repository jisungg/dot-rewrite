import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { Note, SemanticClusterRow } from "@/data/types";
import { backendName } from "@/lib/llm-backend";
import { GROUNDING_RULES } from "@/lib/llm-grounding";
import { buildNoteContextBlock, retrieveTopK } from "@/lib/dot/retrieve";
import {
  HttpError,
  parseJSONBody,
  requireString,
  requireUUID,
  optionalUUID,
  errorResponse,
} from "@/lib/api/validate";
import { requireUser, requireSpaceOwnership } from "@/lib/api/auth";
import { enforceRateLimit, maybeSweep } from "@/lib/api/rate-limit";
import { enforceQuota, quotaHeaders } from "@/lib/api/quota";

// Dot — the per-space chat agent.
//
// Context efficiency: we do NOT ship full notes to the LLM. For each
// turn we:
//   1. retrieve ~6 notes from the focused space via token-overlap against
//      title / TL;DR summary / tags / cluster keywords
//   2. include each retrieved note as {title, cluster, tags, summary}
//      (~80-180 tokens per note, not the full body)
//   3. include the last few chat turns for continuity
//
// A 40-note space typically sends ~1.5-2K input tokens per turn instead
// of 30-100K if we dumped all content.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTEXT_NOTES = 6;
const MAX_HISTORY_TURNS = 4; // 2 user + 2 dot (most recent)
const MAX_PROMPT_CHARS = 2000;

const SYSTEM_PROMPT = `${GROUNDING_RULES}

You are Dot, an assistant that answers questions about a user's personal study notes inside a single "space" (e.g. a class or topic).

You will receive:
- A "Context" block with the user's most-relevant notes, each as:
    - [note_id] Title (Cluster) — tags: ...
      one-or-two-sentence summary
- A brief recent chat history.
- The user's latest question.

OUTPUT FORMAT:
- Reply in GitHub-flavored markdown. Use **bold**, *italic*, and \`inline code\` where appropriate. Do NOT wrap your whole reply in a code fence.

- Bullet lists: when the user asks for a summary, list, comparison, or anything multi-item, output a real markdown bullet list. Each item starts with "- " on its own line, with a blank line above the list. NEVER write a list as paragraph after paragraph separated only by blank lines — that does not render as a list. Example:

  - **\`[Linear Algebra Vectors](#note-...)\`** — short description here
  - **\`[Probability](#note-...)\`** — short description here

- Math: use $...$ for inline math and $$...$$ for display math (KaTeX). ANY formula, equation, variable name in a formula, or symbolic expression MUST be inside math delimiters — including things like $\\vec{a}\\cdot\\vec{b}$, $\\text{proj}_{\\vec{b}}\\vec{a} = \\frac{\\vec{a}\\cdot\\vec{b}}{\\vec{b}\\cdot\\vec{b}}\\vec{b}$, $P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}$, $f'(x)$. Do NOT write formulas as ASCII like "proj_b(a) = (a·b)/(b·b) × b" — always render them in LaTeX inside $...$.

- Code: use fenced code blocks with a language tag, e.g. \`\`\`python or \`\`\`ts. Inline identifiers, function names, and short snippets go in single-backtick \`inline code\`.

- Whenever you reference a specific note, link to it with the markdown form [Title](#note-NOTE_ID), where NOTE_ID is the bracketed id from the Context block (a uuid). Note the leading "#note-" prefix — that is what makes the link clickable in the UI. Use the visible Title shown in the Context block verbatim; do not invent titles.

- Never write a bare [NOTE_ID], a plain "Note 12", or a different protocol like note:UUID — always use the (#note-NOTE_ID) form.

- Keep answers concise: 3-6 sentences for prose, or a short bulleted list when summarizing or comparing items. No preamble. No "Based on the notes you provided…" or "Here's a summary…". Get straight to the answer.

GROUNDING RULES:
- Ground every claim in the Context block. Do not invent facts, topics, or notes that are not in the Context.
- If the user asks for themes, comparisons, or summaries, synthesize across the supplied notes rather than listing them one-by-one.
- If the Context block is empty or irrelevant to the question, give a short, honest reply such as "I don't see anything about that in this space yet" — do not fabricate.

Never mention retrieval, embeddings, the context block, or note IDs in your visible output. The user only knows about their notes.`;

export async function POST(req: Request) {
  try {
    maybeSweep();
    const body = await parseJSONBody<Record<string, unknown>>(req);
    const spaceId = requireUUID(body["spaceId"], "spaceId");
    const promptRaw = requireString(body["prompt"], "prompt", {
      min: 1,
      max: MAX_PROMPT_CHARS,
    }).trim();
    if (promptRaw.length === 0) {
      throw new HttpError(400, "empty_prompt");
    }
    const cappedPrompt = promptRaw.slice(0, MAX_PROMPT_CHARS);
    const focusedNoteId = optionalUUID(body["focusedNoteId"], "focusedNoteId");

    const ctx = await requireUser();
    enforceRateLimit(ctx.user.id, "llm_default");
    const supabase = ctx.supabase;
    const user = ctx.user;
    const quota = await enforceQuota(supabase, user.id, "dot.chat");
    const space = await requireSpaceOwnership(ctx, spaceId);

  // Pull the candidates for retrieval. We only need identifiers + cached
  // summaries + tags, not bodies. Explicit column list keeps the wire
  // payload small even when a user has long notes.
  const { data: noteRows } = await supabase
    .from("notes")
    .select(
      "id, user_id, space_id, title, content, tags, pinned, processed, archived, created_at, last_modified_at, cache",
    )
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .eq("archived", false);
  const notes = (noteRows ?? []) as Note[];

  const { data: clusterRows } = await supabase
    .from("semantic_topic_clusters")
    .select(
      "id, space_id, stable_id, label, keywords, note_ids, cohesion, parent_topic, hierarchy_path, evidence_terms, excluded_terms, secondary_topics, llm_confidence, source",
    )
    .eq("space_id", spaceId);
  const clusters = (clusterRows ?? []) as SemanticClusterRow[];

  const candidates = retrieveTopK({
    question: cappedPrompt,
    notes,
    clusters,
    k: MAX_CONTEXT_NOTES,
    focusedNoteId,
  });
  const contextBlock = buildNoteContextBlock(candidates, {
    maxSummaryChars: 360,
  });

  // Grab the last few chat turns for continuity. We ask Postgres to sort
  // DESC then flip in JS so we always get the most-recent turns.
  const { data: historyRows } = await supabase
    .from("messages")
    .select("role, content, timestamp")
    .eq("user_id", user.id)
    .eq("space_id", spaceId)
    .order("timestamp", { ascending: false })
    .limit(MAX_HISTORY_TURNS);
  const history = ((historyRows ?? []) as Array<{
    role: "user" | "dot";
    content: string;
    timestamp: string;
  }>).reverse();

  const userTurn =
    `Context (${candidates.length} note${candidates.length === 1 ? "" : "s"} from "${
      space.name
    }"):\n${contextBlock || "(no relevant notes found)"}\n\n` +
    (history.length > 0
      ? `Recent conversation:\n${history
          .map(
            (h) =>
              `${h.role === "user" ? "User" : "Dot"}: ${h.content.slice(0, 800)}`,
          )
          .join("\n")}\n\n`
      : "") +
    `User: ${cappedPrompt}`;

  // Insert the user message upfront so it's persisted even if the model
  // call fails midway.
  const { error: userInsertErr } = await supabase.from("messages").insert({
    user_id: user.id,
    space_id: spaceId,
    role: "user",
    content: cappedPrompt,
  });
  if (userInsertErr) {
    console.warn("dot.chat: user message insert failed:", userInsertErr.message);
  }

  // Stream the response token-by-token.
  const backend = backendName();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      const emit = (chunk: string) => {
        buffer += chunk;
        controller.enqueue(encoder.encode(chunk));
      };
      try {
        if (backend === "ollama") {
          await streamOllama(userTurn, emit);
        } else {
          await streamAnthropic(userTurn, emit);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("dot.chat: stream failed:", msg);
        emit(
          "\n\n[The model call failed. " +
            (backend === "ollama"
              ? "Is `ollama serve` running?"
              : "Check ANTHROPIC_API_KEY.") +
            "]",
        );
      } finally {
        controller.close();
        // Persist the assistant turn once it's complete.
        const final = buffer.trim();
        if (final) {
          const { error: dotInsertErr } = await supabase
            .from("messages")
            .insert({
              user_id: user.id,
              space_id: spaceId,
              role: "dot",
              content: final,
            });
          if (dotInsertErr) {
            console.warn(
              "dot.chat: assistant message insert failed:",
              dotInsertErr.message,
            );
          }
        }
      }
    },
  });

    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-dot-context-notes": String(candidates.length),
        ...quotaHeaders(quota),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

async function streamAnthropic(
  userTurn: string,
  emit: (chunk: string) => void,
) {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });
  const model =
    process.env["ANTHROPIC_DOT_MODEL"] ?? "claude-haiku-4-5";
  const response = client.messages.stream({
    model,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
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

async function streamOllama(userTurn: string, emit: (chunk: string) => void) {
  const baseURL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1";
  const apiKey = process.env["OLLAMA_API_KEY"] ?? "ollama";
  const client = new OpenAI({ baseURL, apiKey });
  const model =
    process.env["OLLAMA_DOT_MODEL"] ??
    process.env["OLLAMA_MODEL"] ??
    "qwen2.5:7b-instruct";
  const stream = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userTurn },
    ],
  });
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) emit(delta);
  }
}
