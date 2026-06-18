import { NextRequest } from "next/server";
import { runBrainStream, type ControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * Streaming variant of the daily-questions briefing.
 *
 * Returns a text/event-stream with three event types:
 *   - event: delta     data: { text: "..." }      // append to the buffer
 *   - event: gate      data: { suppressed: true, reason: "..." }
 *   - event: done      data: { provider, model, parsed?: object }
 *   - event: error     data: { error, kind?, provider? }
 *
 * The "delta" events stream raw JSON text from the model (since we request
 * JSON mode). The client buffers them and renders a partial-parse on the way,
 * then a clean parse on the final `done` event.
 */

const SYSTEM_PROMPT = `You are ELOSTATE, surfacing today's open questions for an executive.

You do NOT recommend actions. You do NOT diagnose problems on day one. You surface what
the data is asking — the questions the executive should be holding open today and the
uncertainties that deserve their attention. The executive decides what to do; your role
is to ensure they are looking at the right things.

Return strict JSON:
{
  "todaysQuestions": ["What's the underlying reason X is happening? — surfaced because Y."],
  "uncertainties": ["Z is unclear — we have signal A but not signal B. Looking for B would sharpen the picture."],
  "thingsWorthNoticing": ["Concrete observation from the data. Stated, not interpreted."]
}

Rules:
- Every question must end with "— surfaced because <evidence from the data>".
- Uncertainties must name what additional signal would resolve them.
- Things worth noticing are factual observations, not judgments.
- Do NOT use words like "recommend", "should", "must" — that's overtaking.
- Do NOT generate a "risks" section or an "actions" section.`;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "briefing-stream", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const context = JSON.stringify(body, null, 2);
  const companyId = await getCurrentCompanyId();

  // Per TT.md A21 audit (2026-06-18) HIGH finding — until this fix, when
  // companyId was undefined (demo mode, incomplete onboarding, or auth
  // gap) the route fell through to a direct llmStream call that bypassed
  // the §3.4 control gate entirely. That made the constitutional gate
  // skippable by any unauthenticated context. Honest fix: require a
  // company id. The briefing is per-team; a context-less briefing has
  // no §3.4 baseline to honor.
  if (!companyId) {
    return new Response(
      JSON.stringify({
        error:
          "Briefing requires a signed-in user with a company. The §3.4 control gate is per-team and can't be evaluated without one.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      try {
        let collected = "";
        let gate: ControlGate | undefined;

        const gen = runBrainStream({
          companyId,
          basePrompt: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Surface today's open questions and uncertainties from this company data:\n\n${context}`,
            },
          ],
          maxTokens: 700,
          expectJson: true,
        });
        let next = await gen.next();
        while (!next.done) {
          const delta: string = next.value;
          collected += delta;
          send("delta", { text: delta });
          next = await gen.next();
        }
        gate = next.value.gate;
        if (!gate.guidanceEnabled) {
          send("gate", { suppressed: true, reason: gate.reason });
          send("done", { suppressed: true });
          controller.close();
          return;
        }

        let parsed: unknown = null;
        try {
          parsed = JSON.parse(collected);
        } catch {
          /* fall through; client may still be useful with partial parse */
        }
        send("done", { parsed });
        controller.close();
      } catch (err) {
        if (err instanceof LlmError) {
          send("error", {
            error: err.message,
            kind: err.kind,
            provider: err.provider,
          });
        } else {
          send("error", {
            error: err instanceof Error ? err.message : "Unknown error",
          });
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
      "X-Accel-Buffering": "no", // disable proxy buffering for nginx-like setups
    },
  });
}
