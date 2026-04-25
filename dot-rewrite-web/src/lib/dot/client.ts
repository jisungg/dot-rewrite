import { handleQuotaResponse } from "@/lib/quota-toast";

export type DotChatOptions = {
  spaceId: string;
  prompt: string;
  focusedNoteId?: string | null;
  tone?: string | null;
  signal?: AbortSignal;
  onToken?: (chunk: string, full: string) => void;
};

export type DotChatResult = {
  full: string;
  contextNotes: number;
};

export async function streamDotChat(
  opts: DotChatOptions,
): Promise<DotChatResult> {
  const res = await fetch("/api/dot/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      spaceId: opts.spaceId,
      prompt: opts.prompt,
      focusedNoteId: opts.focusedNoteId ?? null,
      tone: opts.tone ?? null,
    }),
  });
  const blocked = handleQuotaResponse(res, "Dot");
  if (blocked) {
    // Soft-stop: toast is already shown. Return an empty result so the
    // chat surface doesn't render a raw error.
    return { full: "", contextNotes: 0 };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `dot_chat_failed_${res.status}`);
  }
  const contextNotes = Number(res.headers.get("x-dot-context-notes") ?? 0);
  const reader = res.body?.getReader();
  if (!reader) return { full: "", contextNotes };
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (chunk.length > 0) {
      full += chunk;
      opts.onToken?.(chunk, full);
    }
  }
  return { full, contextNotes };
}
