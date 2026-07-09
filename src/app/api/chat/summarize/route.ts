import { NextRequest, NextResponse } from "next/server";
import { llmStream } from "@/lib/llm";
import { runBrainStream, type ControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/chat/summarize
 *
 * Summarize a chat topic so far. Output is explicitly framed as "the
 * System's read — confirm or correct" so the human stays the judge of
 * what the conversation actually meant (§3.3).
 *
 * Request body:
 *   { topic: { title, description }, messages: ChatMessage[] }
 *
 * SSE events: delta / gate / done / error.
 */

const SYSTEM_PROMPT = `You are ELOSTATE, summarizing a team-chat topic so far.

Discipline:
- This summary is YOUR READ. The humans in the chat are the source of truth. Frame it as such.
- Do NOT recommend, decide, or assert what should happen next. That's overtaking.
- Stick to what was actually said and what was actually left unresolved.

Output rules:
- Write in markdown, this exact shape:

**Summary so far (System's read — confirm or correct):**
- <fact or position someone in the chat actually stated>
- <fact or position someone actually stated>
- <…3 to 6 bullets total, oldest material first>

**Still unresolved or unclear:**
- <a real open question or disagreement visible in the messages>
- <a real gap in evidence the chat itself has named>

End with one line: *"Please confirm, correct, or replace this read."*

Hard rules:
- No "I recommend", "you should", "the team needs to". State, don't direct.
- No bullets that go beyond what the messages actually said.
- If there's not enough material yet to summarize, say so honestly instead of inventing structure.`;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "chat-summarize", windowMs: 60_000, max: 8 });
  if (limited) return limited;

  // Auth gate (audit 2026-07-09): require a signed-in user before the LLM call — an
  // anon caller otherwise drives the model on our bill (middleware doesn't cover
  // /api/*; getCurrentCompanyId returns null, not an error, for anon).
  const _authClient = await createClient();
  const { data: _authData } = await _authClient.auth.getUser();
  if (!_authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    topic?: { title?: string; description?: string };
    messages?: Array<{ author?: string; content: string; createdAt?: string }>;
  };

  const messages = body.messages ?? [];
  if (messages.length < 2) {
    return new Response(
      JSON.stringify({ error: "at least 2 messages required to summarize" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const userTurn = [
    body.topic?.title && `Topic: ${body.topic.title}`,
    body.topic?.description && `Description: ${body.topic.description}`,
    "",
    "Messages (oldest first):",
    ...messages.map(
      (m, i) => `  ${i + 1}. ${m.author ?? "?"}: ${m.content}`
    ),
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
            maxTokens: 600,
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
            maxTokens: 600,
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
