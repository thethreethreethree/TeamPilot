import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { SUMMARIZE_SYSTEM } from "@/lib/care/toolPrompts";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/care/extension/summarize — Summarize, for the C.A.R.E browser extension
 * (spec docs/feature-specs/CARE-BROWSER-EXTENSION.md, Phase 0 reference endpoint).
 *
 * Text-in → result-out: the extension sends the SCANNED conversation text (from Gmail/Zendesk/etc.), not a
 * Care conversation-ID. Runs the EXACT same prompt as the in-app tool (SUMMARIZE_SYSTEM, shared — no drift,
 * §3.4), grounded in the tenant's product context.
 *
 * GATES: requireEntitledExtensionUser (Bearer token + pro/enterprise-or-trial entitlement, server-enforced —
 * never trust the client) → per-user rate limit.
 *
 * DATA GOVERNANCE (D1 — ephemeral): the scanned `conversation` text is processed to generate the summary and
 * then DISCARDED. Nothing here writes it to storage.
 *
 * CONTROL-WINDOW NOTE (§3.4): this is a paid product TOOL operating on EXTERNAL conversations (the user's
 * other inboxes), not the team's own internal event chain, so — like C.A.R.E itself (messages route) — it is
 * intentionally NOT gated by the month-1 team-coaching control window. companyId is used only to fetch
 * grounding, not routed through the control gate. (Flagged for the governed audit.)
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z
  .object({
    conversation: z.string().min(1).max(20_000),
  })
  .strict();

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "summarize", perUserMax: 20, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  const productContext = await getProductContextForTenant(user.companyId);

  try {
    const r = await generateCareReply({
      systemPrompt: SUMMARIZE_SYSTEM,
      userMessage: `Product context the agent is grounded in:\n${productContext}\n\nConversation:\n${body.conversation}\n\nWrite the summary.`,
    });
    return NextResponse.json({ summary: r.text.trim() });
  } catch (err) {
    // A rate-limit from the model maps to 429 so the client backs off correctly
    // (matching the spawn/coach/copilot/formulate routes); any other failure is a 502.
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
      );
    }
    return NextResponse.json({ error: "Couldn't generate a summary right now." }, { status: 502 });
  }
}
