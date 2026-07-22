import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { FORMULATE_SYSTEM } from "@/lib/care/toolPrompts";

/**
 * POST /api/care/extension/formulate — Formulate C.A.R.E, for the browser extension.
 *
 * Text-in ({ conversation, intent }) → { reply, reasoning }: the agent says WHAT they want to communicate
 * (their intent); the tool shapes it into a warm, grounded, customer-facing reply. Runs the SAME prompt
 * (FORMULATE_SYSTEM, shared with the in-app route — §3.4 no drift) grounded in the tenant's product context.
 * Per §A8 it shapes the agent's intent, it does NOT render a verdict on it.
 *
 * GATES: requireEntitledExtensionUser → per-user rate limit.
 * DATA GOVERNANCE (D1 — ephemeral): conversation + intent are processed then DISCARDED.
 * CONTROL-WINDOW (§3.4 / A3): acts on the user's EXTERNAL conversation → NOT control-gated (see copilot route).
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
  const preAuth = rateLimit(req, { id: "care-ext", windowMs: 60_000, max: 60 });
  if (preAuth) return preAuth;

  const gate = await requireEntitledExtensionUser(req);
  if (!gate.ok) return gate.response;

  const limited = rateLimit(req, {
    id: `care-ext-formulate:${gate.user.userId}`,
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const body = await readBody(req, Schema);
  if (body instanceof NextResponse) return body;

  const productContext = await getProductContextForTenant(gate.user.companyId);

  try {
    const r = await generateCareReply({
      systemPrompt: `${FORMULATE_SYSTEM}

Product context the customer is reaching out about:
${productContext}`,
      userMessage: `Conversation so far:\n${body.conversation}\n\nAgent's intent (what they want to communicate):\n${body.intent}\n\nShape the agent's intent into a reply. Return STRICT JSON.`,
    });
    // The prompt asks for strict JSON {reply, reasoning}; degrade gracefully if the model wraps or strays.
    let reply = "";
    let reasoning = "";
    try {
      const parsed = JSON.parse(r.text) as { reply?: unknown; reasoning?: unknown };
      reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
      reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
    } catch {
      // Non-JSON fallback: surface the raw text as the reply rather than erroring the agent out.
      reply = r.text.trim();
    }
    if (!reply) {
      return NextResponse.json(
        { error: "Formulate couldn't shape that intent right now. Try rephrasing what you want to say." },
        { status: 502 }
      );
    }
    return NextResponse.json({ reply, reasoning });
  } catch {
    return NextResponse.json(
      { error: "Formulate couldn't shape a reply right now." },
      { status: 502 }
    );
  }
}
