import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { CO_PILOT_SYSTEM } from "@/lib/care/toolPrompts";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/care/extension/copilot — AI Co-Pilot, for the C.A.R.E browser extension.
 *
 * Text-in → { reply, reasoning }: the extension sends the SCANNED conversation text and gets back a drafted
 * next reply (customer-facing) plus a one-line internal reasoning (which communication move, for the agent's
 * learning — §A18). Runs the same draft DISCIPLINE as the in-app co-pilot via CO_PILOT_SYSTEM (the extension
 * variant — see toolPrompts.ts; not byte-identical to the in-app inline prompt, which also grounds on stored
 * precedents + prior Coach grades the text-in extension can't see). Grounded in the tenant's product context.
 *
 * GATES: requireEntitledExtensionUser (Bearer + pro/enterprise-or-trial, server-enforced) → per-user rate limit.
 *
 * DATA GOVERNANCE (D1 — ephemeral): the scanned `conversation` is processed to draft the reply, then DISCARDED.
 *
 * CONTROL-WINDOW NOTE (§3.4 / A3): like Summarize/Dissect, this is a paid product TOOL acting on the user's
 * EXTERNAL conversation (their other inbox), NOT the team's internal event chain — so, per the A3-sharpened
 * decision, it is intentionally NOT gated by the month-1 team-coaching control window. (Only Spawn task, which
 * writes into the internal chain, carries that gate.) companyId is used only to fetch grounding.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z
  .object({
    conversation: z.string().min(1).max(20_000),
  })
  .strict();

const REASONING_MARKER = "===REASONING===";

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "copilot", perUserMax: 20, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  const productContext = await getProductContextForTenant(user.companyId);

  try {
    const r = await generateCareReply({
      systemPrompt: `${CO_PILOT_SYSTEM}

Product context the customer is reaching out about:
${productContext}`,
      userMessage: `Conversation so far:\n${body.conversation}\n\nDraft the next reply.`,
    });
    const raw = r.text;
    const idx = raw.indexOf(REASONING_MARKER);
    const reply = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
    const reasoning = idx >= 0 ? raw.slice(idx + REASONING_MARKER.length).trim() : "";
    // Guard an empty draft (e.g. the model emitted the ===REASONING=== marker first) — consistent with the
    // formulate route. Without this the panel would fall through to rendering the raw JSON.
    if (!reply) {
      return NextResponse.json(
        { error: "The Co-Pilot couldn't draft a reply right now. Try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ reply, reasoning });
  } catch (err) {
    // A rate-limit from the model maps to 429 so the client backs off correctly
    // (matching the spawn/coach routes); any other failure is a 502.
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
      );
    }
    return NextResponse.json(
      { error: "The Co-Pilot couldn't draft a reply right now." },
      { status: 502 }
    );
  }
}
