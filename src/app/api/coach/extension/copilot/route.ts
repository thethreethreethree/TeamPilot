import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSalesCopilotReply } from "@/lib/coach/extension/salesCopilot";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/coach/extension/copilot — AI Co-Pilot ("draft my reply"), for the Sales Coach browser extension.
 *
 * Text-in ({ conversation, lastSpeaker? }) → { reply, reasoning }: a drafted next message to the prospect
 * plus a one-line naming of the sales MOVE (for the rep's learning). The sales analogue of the C.A.R.E
 * extension co-pilot, grounded in the SALES methodology, and mode-aware (agent-last → follow-up).
 *
 * Gates reuse the shared, product-neutral guard (guardExtensionRequest): IP guard → entitlement → per-user
 * rate limit. EPHEMERAL — the scanned conversation is processed and NOT stored.
 *
 * CONTROL-WINDOW: like the C.A.R.E co-pilot, this acts on the rep's EXTERNAL conversation, not the team's
 * internal event chain, so it is intentionally NOT gated by the month-1 control window (A3). An LlmError
 * maps to 429/502; an empty draft is a 502 (never a blank reply).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z
  .object({
    conversation: z.string().min(1).max(20_000),
    // Who sent the LAST message — supplied by the adapter from the DOM where known (agent-last → follow-up,
    // customer-last → reply, absent/unknown → determine + default to reply). Optional so any caller works.
    lastSpeaker: z.enum(["agent", "customer", "unknown"]).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "coach-copilot", perUserMax: 20, schema: Schema, productLabel: "Sales Coach extension" });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  // Rep identity anchor: without naming the rep, an unlabeled thread makes the model guess who's who and can
  // address the draft TO the rep. Best-effort; the draft never blocks on the lookup.
  let repName = "the sales rep";
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.userId)
      .maybeSingle();
    if (typeof prof?.full_name === "string" && prof.full_name.trim()) {
      repName = prof.full_name.trim();
    }
  } catch {
    /* best-effort; the WHO-IS-WHO discipline still applies with the generic label */
  }

  try {
    const { reply, reasoning } = await generateSalesCopilotReply({
      companyId: user.companyId,
      conversation: body.conversation,
      repName,
      lastSpeaker: body.lastSpeaker,
    });
    // Guard an empty draft (e.g. the model emitted the marker first) — never render a blank reply.
    if (!reply) {
      return NextResponse.json(
        { error: "The Co-Pilot couldn't draft a reply right now. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ reply, reasoning });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
      );
    }
    console.error("[coach/extension/copilot] non-LLM failure:", err);
    return NextResponse.json(
      { error: "The Co-Pilot couldn't draft a reply right now." },
      { status: 502 }
    );
  }
}
