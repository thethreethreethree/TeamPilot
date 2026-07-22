import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { SUMMARIZE_SYSTEM } from "@/lib/care/toolPrompts";

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
  // Audit A1 (2026-07-22): a coarse per-IP guard BEFORE auth protects the token-validation round-trip
  // from unauthenticated floods; the real limit below is per-USER (so colleagues on one office IP don't
  // share a bucket on a paid feature).
  const preAuth = rateLimit(req, { id: "care-ext", windowMs: 60_000, max: 60 });
  if (preAuth) return preAuth;

  const gate = await requireEntitledExtensionUser(req);
  if (!gate.ok) return gate.response;

  const limited = rateLimit(req, {
    id: `care-ext-summarize:${gate.user.userId}`,
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const body = await readBody(req, Schema);
  if (body instanceof NextResponse) return body;

  const productContext = await getProductContextForTenant(gate.user.companyId);

  try {
    const r = await generateCareReply({
      systemPrompt: SUMMARIZE_SYSTEM,
      userMessage: `Product context the agent is grounded in:\n${productContext}\n\nConversation:\n${body.conversation}\n\nWrite the summary.`,
    });
    return NextResponse.json({ summary: r.text.trim() });
  } catch {
    return NextResponse.json({ error: "Couldn't generate a summary right now." }, { status: 502 });
  }
}
