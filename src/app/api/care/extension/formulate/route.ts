import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { FORMULATE_SYSTEM } from "@/lib/care/toolPrompts";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/care/extension/formulate — Formulate C.A.R.E, for the browser extension.
 *
 * Text-in ({ conversation, intent }) → { reply, reasoning }: the agent says WHAT they want to communicate
 * (their intent); the tool shapes it into a warm, grounded, customer-facing reply. Uses FORMULATE_SYSTEM (the
 * extension variant — see toolPrompts.ts; returns `{reply}` where the in-app route returns `{draft}`), grounded
 * in the tenant's product context. Per §A8 it shapes the agent's intent, it does NOT render a verdict on it.
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
  const guard = await guardExtensionRequest(req, { tool: "formulate", perUserMax: 20, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  const productContext = await getProductContextForTenant(user.companyId);

  // Agent identity anchor (A26 sweep of the Spawn/Co-Pilot role-attribution class, 2026-07-24).
  // FORMULATE_SYSTEM's WHO-IS-WHO rule expects the caller to name the agent, but the route never
  // did — so the scanned thread's roles were left to the model to guess. Supply the name.
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
    /* best-effort; the WHO-IS-WHO rule still applies with the generic label */
  }

  try {
    const r = await generateCareReply({
      systemPrompt: `${FORMULATE_SYSTEM}

You are shaping the reply AS: ${agentName}. In the conversation, messages from ${agentName} are the agent's own words — continue ${agentName}'s side, and never address the reply to ${agentName}.

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
      { error: "Formulate couldn't shape a reply right now." },
      { status: 502 }
    );
  }
}
