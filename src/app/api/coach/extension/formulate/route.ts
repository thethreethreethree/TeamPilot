import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { resolveRepName } from "@/lib/coach/extension/repName";
import { generateSalesFormulate } from "@/lib/coach/extension/salesFormulate";
import { llmErrorResponse } from "@/lib/coach/extension/llmErrorResponse";

/**
 * POST /api/coach/extension/formulate — "Say it for me", for the Sales Coach browser extension.
 *
 * Text-in ({ conversation, intent }) → { reply, reasoning }: the rep says WHAT they want to convey (their
 * intent); the tool shapes it into a sales-effective message + names the move. Distinct from co-pilot (which
 * decides what to say from the conversation) — formulate phrases the rep's OWN intent well. Grounded in the
 * sales methodology. It shapes the intent, it does not judge it (mirror, not verdict).
 *
 * Gates reuse the shared guard (guardExtensionRequest): IP → entitlement → per-user rate limit. EPHEMERAL —
 * conversation + intent processed, NOT stored. Empty reply → 502; LlmError → 429/502.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z
  .object({
    conversation: z.string().min(1).max(20_000),
    intent: z.string().min(1).max(2_000),
  })
  .strict();

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, {
    tool: "coach-formulate",
    perUserMax: 20,
    schema: Schema,
    productLabel: "Sales Coach extension",
  });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  // Rep identity anchor: shape the message in the rep's voice, not addressed to them. Best-effort.
  const repName = await resolveRepName(user.userId);

  try {
    const { reply, reasoning } = await generateSalesFormulate({
      companyId: user.companyId,
      conversation: body.conversation,
      intent: body.intent,
      repName,
    });
    if (!reply) {
      return NextResponse.json(
        { error: "Couldn't shape that into a message right now. Try rephrasing what you want to say." },
        { status: 502 }
      );
    }
    return NextResponse.json({ reply, reasoning });
  } catch (err) {
    return llmErrorResponse(err, {
      logTag: "coach/extension/formulate",
      fallbackMessage: "Couldn't shape a message right now.",
    });
  }
}
