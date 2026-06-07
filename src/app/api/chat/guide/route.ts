import { NextRequest } from "next/server";
import { llmStream } from "@/lib/llm";
import { runBrainStream, type ControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/chat/guide
 *
 * "Guide my response." The user has a draft. We stream back a sharper
 * version they can adopt, tweak, or discard. The System never decides
 * for them — it offers a refinement (§3.3 guide-don't-overtake).
 *
 * Request body:
 *   { draft: string, topic: { title, description }, recent: ChatMessage[] }
 *
 * SSE events:
 *   - delta: { text }
 *   - gate:  { suppressed: true, reason }   (§3.4 control window)
 *   - done:  {}
 *   - error: { error, kind?, provider? }
 */

const SYSTEM_PROMPT = `You are ELOSTATE, helping a team member sharpen their draft chat message.

Your task: produce a clearer, more specific, less hedged version of their draft — IN THEIR VOICE. You are not writing a new message; you are surfacing what they were trying to say more precisely.

Discipline:
- Keep their meaning, intent, and tone. Do not invent new claims, soften their disagreement, or add diplomatic padding they didn't write.
- Cut filler ("just", "really", "kind of", "I think maybe") only when removing it does not change meaning.
- Make vague pronouns specific where the conversation context makes the referent clear.
- If their draft contains a question, keep it a question. If it states a position, keep the position.
- If the draft is already clear and direct, return it nearly unchanged. Honesty beats interference.

Output rules:
- Reply with the sharpened version ONLY. No preamble, no "here's a sharper version", no quotation marks, no markdown formatting. Just the message text, as the user could paste it directly.
- Hard ceiling: never longer than the original draft + 25%.

The user remains in charge: this is a suggestion they will accept, edit, or discard.`;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "chat-guide", windowMs: 60_000, max: 12 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    draft?: string;
    topic?: { title?: string; description?: string };
    recent?: Array<{ author?: string; content: string }>;
  };

  const draft = (body.draft ?? "").trim();
  if (draft.length < 1) {
    return new Response(
      JSON.stringify({ error: "draft is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build the user-turn payload so the model has just enough context:
  // the topic header and the last few messages, then the draft itself.
  const context = [
    body.topic?.title && `Topic: ${body.topic.title}`,
    body.topic?.description && `Description: ${body.topic.description}`,
    body.recent?.length
      ? "Recent messages (oldest first):\n" +
        body.recent
          .slice(-6)
          .map((m) => `  ${m.author ?? "?"}: ${m.content}`)
          .join("\n")
      : null,
    `\nUser's draft (sharpen this):\n${draft}`,
  ]
    .filter(Boolean)
    .join("\n");

  const companyId = (await getCurrentCompanyId()) ?? undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      try {
        if (companyId) {
          const gen = runBrainStream({
            companyId,
            basePrompt: SYSTEM_PROMPT,
            messages: [{ role: "user", content: context }],
            maxTokens: 400,
          });
          let next = await gen.next();
          while (!next.done) {
            send("delta", { text: next.value });
            next = await gen.next();
          }
          const gate: ControlGate = next.value.gate;
          if (!gate.guidanceEnabled) {
            send("gate", { suppressed: true, reason: gate.reason });
          }
        } else {
          // Demo mode (no Supabase): bypass brain and call provider directly.
          for await (const delta of llmStream({
            systemPrompt: SYSTEM_PROMPT,
            messages: [{ role: "user", content: context }],
            maxTokens: 400,
          })) {
            send("delta", { text: delta });
          }
        }
        send("done", {});
        controller.close();
      } catch (err) {
        if (err instanceof LlmError) {
          send("error", { error: err.message, kind: err.kind, provider: err.provider });
        } else {
          send("error", { error: err instanceof Error ? err.message : "Unknown error" });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
