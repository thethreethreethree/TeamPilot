import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { resolveRepName } from "@/lib/coach/extension/repName";
import {
  generateSalesCopilotReply,
  buildSalesCopilotRequest,
} from "@/lib/coach/extension/salesCopilot";
import {
  generateSalesFormulate,
  buildSalesFormulateRequest,
} from "@/lib/coach/extension/salesFormulate";
import { finalizeSuggestion } from "@/lib/coach/extension/salesSuggestFormat";
import { llmErrorResponse } from "@/lib/coach/extension/llmErrorResponse";
import { runBrainStream } from "@/lib/brain";
import { llmStream } from "@/lib/llm";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/coach/extension/suggest — "Suggested Response", for the Sales Coach browser extension.
 *
 * The single merged action (founder 2026-08-09) that replaces the three separate buttons Coach-my-reply /
 * Draft-my-reply / Say-it-for-me. Text-in ({ conversation, guidance?, lastSpeaker? }) → { reply, reasoning }:
 *   - NO guidance  → draft the next message from the conversation alone (the co-pilot engine).
 *   - WITH guidance → shape the rep's own draft/intent into a strong message (the formulate engine); `guidance`
 *                     is the rep's draft OR what they want to get across, used as the steer.
 * Either way it returns a ready-to-send suggestion plus the one-line naming of the sales MOVE (the "why").
 *
 * Reuses the two existing, tested engines rather than a new one, so behavior stays identical to the old
 * buttons — only the surface merged. Gates via the shared guardExtensionRequest (IP → entitlement → per-user
 * rate limit). EPHEMERAL — conversation + guidance processed, NOT stored. Empty reply → 502; LlmError → 429/502.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z
  .object({
    conversation: z.string().min(1).max(20_000),
    // Optional steer: the rep's draft reply OR the intent they want to convey. Blank → generate from scratch.
    guidance: z.string().max(8_000).optional(),
    lastSpeaker: z.enum(["agent", "customer", "unknown"]).optional(),
    // When true, respond as a text/event-stream (the reply forms word-by-word in the panel) instead of one
    // JSON blob. Same engines, same output — only the delivery differs. The client falls back to non-stream
    // on any stream failure, so this can never break the working path.
    stream: z.boolean().optional(),
  })
  .strict();

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Yield the model's content deltas for a suggest request. Mirrors the non-streaming engine's dispatch exactly
 * (companyId → brain-composed + §3.4 gate via runBrainStream; no companyId → direct llmStream), and the same
 * 600-token answer budget generateCareReply uses for text. One mechanism, two deliveries (§A21).
 */
async function* streamSuggestDeltas(args: {
  companyId?: string;
  systemPrompt: string;
  userMessage: string;
}): AsyncIterable<string> {
  const messages = [{ role: "user" as const, content: args.userMessage }];
  if (args.companyId) {
    yield* runBrainStream({
      companyId: args.companyId,
      basePrompt: args.systemPrompt,
      messages,
      maxTokens: 600,
      // Sales Coach runs day-1 (founder decision) — the stream path must be exempt like the non-stream engines,
      // or a month-1 customer's Suggested Response streams empty → error (review Finding, Area 3).
      controlExempt: true,
    });
    return;
  }
  yield* llmStream({ systemPrompt: args.systemPrompt, messages, maxTokens: 600 });
}

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, {
    tool: "coach-suggest",
    perUserMax: 20,
    schema: Schema,
    productLabel: "Sales Coach extension",
  });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  const repName = await resolveRepName(user.userId);
  const guidance = (body.guidance ?? "").trim();

  // ── Streaming delivery ────────────────────────────────────────────────────────────────────────────────
  // The reply forms word-by-word in the panel. We stream the raw content deltas; the client shows everything
  // before the ===REASONING=== marker as the forming reply and captures the move after it. On done we also
  // send the server-split {reply, reasoning} so the client has a clean final render even if it split loosely.
  if (body.stream) {
    // Assembled from the SAME buildRequest helpers the engines use (§A21) so the prompt can't drift between
    // the stream and non-stream surfaces. Built HERE (not above) so the non-stream path — which rebuilds the
    // prompt inside its engine — doesn't assemble the ~5k-token prompt twice on its hot path.
    const { systemPrompt, userMessage } = guidance
      ? buildSalesFormulateRequest({ conversation: body.conversation, intent: guidance, repName })
      : buildSalesCopilotRequest({ conversation: body.conversation, repName, lastSpeaker: body.lastSpeaker });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(sse(event, data)));
        try {
          let collected = "";
          for await (const delta of streamSuggestDeltas({
            companyId: user.companyId,
            systemPrompt,
            userMessage,
          })) {
            collected += delta;
            send("delta", { text: delta });
          }
          const { reply, reasoning } = finalizeSuggestion(collected);
          if (!reply) {
            // Empty after a full stream = the same 502 condition as non-stream (reasoning starved the answer,
            // or the model returned nothing). Say so honestly rather than closing on an empty reply.
            send("error", { error: "Couldn't draft a suggested response right now. Try again." });
          } else {
            send("done", { reply, reasoning });
          }
          controller.close();
        } catch (err) {
          const kind = err instanceof LlmError ? err.kind : undefined;
          if (!(err instanceof LlmError)) {
            // eslint-disable-next-line no-console
            console.error("[coach/extension/suggest stream] non-LLM failure:", err);
          }
          send("error", {
            error: "Couldn't draft a suggested response right now.",
            kind,
          });
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

  // ── Non-streaming delivery (unchanged) ────────────────────────────────────────────────────────────────
  try {
    const { reply, reasoning } = guidance
      ? await generateSalesFormulate({
          companyId: user.companyId,
          conversation: body.conversation,
          intent: guidance,
          repName,
        })
      : await generateSalesCopilotReply({
          companyId: user.companyId,
          conversation: body.conversation,
          repName,
          lastSpeaker: body.lastSpeaker,
        });

    if (!reply) {
      return NextResponse.json(
        { error: "Couldn't draft a suggested response right now. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ reply, reasoning });
  } catch (err) {
    return llmErrorResponse(err, {
      logTag: "coach/extension/suggest",
      fallbackMessage: "Couldn't draft a suggested response right now.",
    });
  }
}
