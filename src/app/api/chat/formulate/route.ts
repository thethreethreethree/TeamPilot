import { NextRequest } from "next/server";
import { llmStream } from "@/lib/llm";
import { runBrainStream, type ControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/chat/formulate
 *
 * "Help me formulate." The user answered three structured prompts about
 * the conversation. We compose a draft response grounded in THEIR
 * answers — not the System's read. The output is a starting point for
 * them to edit, not a final word (§3.3).
 *
 * Request body:
 *   { answers: [string,string,string],
 *     topic: { title, description },
 *     recent: ChatMessage[] }
 *
 * SSE events: delta / gate / done / error  (same shape as /chat/guide).
 */

const SYSTEM_PROMPT = `You are ELOSTATE, composing a draft chat message FROM the team member's own reading of the conversation.

You will receive their answers to three short prompts:
  1. Their read of what the conversation is actually about.
  2. The outcome they would consider a success.
  3. The concern or risk not yet being named.

Compose a single chat message — first-person, in their voice — that surfaces those three things in the conversation. The message should:
  - Open by naming what they think the discussion is actually about (from answer 1).
  - Then say what a successful outcome looks like, from their perspective (answer 2).
  - Then surface the unspoken concern (answer 3), as something to address — not as a complaint.

Discipline:
- Use their words and framing. Do not invent claims, soften their concern, or add caveats they did not write.
- This is THEIR voice expressing THEIR read. Avoid sounding like the System speaking for them.
- Keep it short (under 120 words) and direct. No bullet points, no headers — write it as one piece of natural chat prose.
- If their answers contradict each other or leave a gap, surface that honestly inside the draft rather than smoothing it over.

Output rules:
- Reply with the composed message ONLY. No preamble, no "here's a draft", no quotation marks, no markdown. Just the chat message text.
- The user will edit before sending. This is a starting draft, not a final word.`;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "chat-formulate", windowMs: 60_000, max: 12 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    answers?: string[];
    topic?: { title?: string; description?: string };
    recent?: Array<{ author?: string; content: string }>;
  };

  const answers = (body.answers ?? []).map((a) => (a ?? "").trim());
  if (answers.length !== 3 || answers.some((a) => a.length < 5)) {
    return new Response(
      JSON.stringify({ error: "three answers, each at least 5 chars, required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const userTurn = [
    body.topic?.title && `Topic: ${body.topic.title}`,
    body.topic?.description && `Description: ${body.topic.description}`,
    body.recent?.length
      ? "Recent messages (oldest first):\n" +
        body.recent
          .slice(-6)
          .map((m) => `  ${m.author ?? "?"}: ${m.content}`)
          .join("\n")
      : null,
    "",
    "User's three answers (compose a draft from these):",
    `1. What the conversation is actually about: ${answers[0]}`,
    `2. What success looks like: ${answers[1]}`,
    `3. The unspoken concern: ${answers[2]}`,
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
            messages: [{ role: "user", content: userTurn }],
            maxTokens: 500,
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
          for await (const delta of llmStream({
            systemPrompt: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userTurn }],
            maxTokens: 500,
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
