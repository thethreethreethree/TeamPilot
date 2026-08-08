import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { resolveRepName } from "@/lib/coach/extension/repName";
import { generateSalesCopilotReply } from "@/lib/coach/extension/salesCopilot";
import { generateSalesFormulate } from "@/lib/coach/extension/salesFormulate";
import { llmErrorResponse } from "@/lib/coach/extension/llmErrorResponse";

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
  })
  .strict();

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
