import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Agent identity anchor (A26 sweep of the role-attribution class, 2026-07-24). A summary that swaps
  // who-said-what is wrong, and the scanned thread has no per-message role labels — so tell the model
  // which side is the agent. Best-effort; the anchor is a no-op with the generic label.
  let agentName = "the support agent";
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.userId)
      .maybeSingle();
    if (typeof prof?.full_name === "string" && prof.full_name.trim())
      agentName = prof.full_name.trim();
  } catch {
    /* best-effort */
  }

  try {
    const r = await generateCareReply({
      systemPrompt: `${SUMMARIZE_SYSTEM}

WHO IS WHO: the C.A.R.E user (the support agent) is ${agentName}. In the conversation, messages from ${agentName} are the agent's side; the other participant is the customer. Attribute who said what on that basis — do not swap the roles.`,
      userMessage: `Product context the agent is grounded in:\n${productContext}\n\nConversation:\n${body.conversation}\n\nWrite the summary.`,
    });
    const summary = r.text.trim();
    // Guard an empty summary — a blank "caught up" would read as "nothing to summarize" (§3.4), the exact
    // false-empty this tool must never emit. Consistent with the copilot/formulate empty-reply guards.
    if (!summary) {
      console.error("[care/extension/summarize] model returned an empty summary");
      return NextResponse.json({ error: "Couldn't generate a summary right now." }, { status: 502 });
    }
    return NextResponse.json({ summary });
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
