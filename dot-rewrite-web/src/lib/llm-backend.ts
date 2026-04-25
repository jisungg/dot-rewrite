import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Single entry point used by every server-side Claude call in the app.
// Backend is picked by LLM_BACKEND ("anthropic" | "ollama"). Defaults to
// anthropic so nothing changes for existing deployments.
//
// Ollama path: OpenAI-compatible chat completions against a local Ollama
// daemon (`ollama serve` → http://localhost:11434/v1). No API key leaves
// the machine, no network calls. Set LLM_BACKEND=ollama to enable.

export const ANTHROPIC = "anthropic";
export const OLLAMA = "ollama";

type Backend = typeof ANTHROPIC | typeof OLLAMA;

export function backendName(): Backend {
  const v = (process.env["LLM_BACKEND"] ?? ANTHROPIC).toLowerCase();
  return v === OLLAMA ? OLLAMA : ANTHROPIC;
}

function resolveModel(
  task: string,
  anthropicDefault: string,
  ollamaDefault: string,
): string {
  if (backendName() === OLLAMA) {
    return (
      process.env[`OLLAMA_${task.toUpperCase()}_MODEL`] ??
      process.env["OLLAMA_MODEL"] ??
      ollamaDefault
    );
  }
  return (
    process.env[`ANTHROPIC_${task.toUpperCase()}_MODEL`] ?? anthropicDefault
  );
}

export type JsonSchema = Record<string, unknown>;

export type CompleteJsonOptions<T> = {
  task: string;
  system: string;
  user: string;
  schema: JsonSchema;
  schemaName?: string;
  maxTokens?: number;
  anthropicDefaultModel?: string;
  ollamaDefaultModel?: string;
  parse?: (raw: unknown) => T;
};

export type CompleteJsonResult<T> =
  | { ok: true; data: T; model: string; backend: Backend }
  | { ok: false; error: string; backend: Backend };

export async function completeJson<T = unknown>(
  opts: CompleteJsonOptions<T>,
): Promise<CompleteJsonResult<T>> {
  const backend = backendName();
  const model = resolveModel(
    opts.task,
    opts.anthropicDefaultModel ?? "claude-haiku-4-5",
    opts.ollamaDefaultModel ?? "qwen2.5:7b-instruct",
  );
  try {
    const raw =
      backend === OLLAMA
        ? await callOllama(opts, model)
        : await callAnthropic(opts, model);
    const data = (opts.parse ? opts.parse(raw) : (raw as T)) as T;
    return { ok: true, data, model, backend };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`llm-backend(${backend}, ${model}):`, msg);
    return { ok: false, error: msg, backend };
  }
}

async function callAnthropic<T>(
  opts: CompleteJsonOptions<T>,
  model: string,
): Promise<unknown> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  // Schema-in-prompt instead of `output_config.format.json_schema`.
  // Structured outputs exist on Claude 4.6+, but the exact field names have
  // drifted across SDK versions; requesting a JSON object via the system
  // prompt + parsing works on every version and gives identical results
  // for small objects.
  const schemaJson = JSON.stringify(opts.schema);
  const augmentedSystem =
    `${opts.system}\n\n` +
    "Return ONLY a single JSON object matching this schema. No prose, no markdown fences, no explanation. Omit any field not described.\n" +
    `Schema:\n${schemaJson}`;

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: [
      {
        type: "text",
        text: augmentedSystem,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: opts.user }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("no_text_block_in_response");
  }
  let text = block.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  // Claude occasionally surrounds JSON with a one-liner preamble; pull the
  // first balanced `{...}` slice if the direct parse fails.
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(
      `anthropic_json_parse_failed: ${text.slice(0, 200).replace(/\s+/g, " ")}`,
    );
  }
}

async function callOllama<T>(
  opts: CompleteJsonOptions<T>,
  model: string,
): Promise<unknown> {
  const baseURL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434/v1";
  const apiKey = process.env["OLLAMA_API_KEY"] ?? "ollama";
  const client = new OpenAI({ baseURL, apiKey });
  const schemaJson = JSON.stringify(opts.schema);
  const augmentedSystem =
    `${opts.system}\n\n` +
    "Return ONLY a single JSON object matching this schema. No prose, no markdown fences, no explanation. Omit any field not described.\n" +
    `Schema:\n${schemaJson}`;
  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: augmentedSystem },
      { role: "user", content: opts.user },
    ],
  });
  let text = response.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("empty_response");
  text = text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(text);
}
