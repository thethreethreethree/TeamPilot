import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { getProductContextForTenant } from "@/lib/care/config";
import { generateCareReply } from "@/lib/claude";
import { CO_PILOT_SYSTEM } from "@/lib/care/toolPrompts";
import { copilotModeInstruction } from "@/lib/care/copilotMode";
import { LlmError } from "@/lib/llm/errors";
import { llmStream } from "@/lib/llm";
import { createAdminClient } from "@/lib/supabase/admin";

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
    // Who sent the LAST message in the thread (founder request 2026-07-23). Supplied by the
    // adapter from the DOM where it can be known (WhatsApp/Gmail); omitted otherwise. Drives the
    // response MODE: agent-last → follow-up, customer-last → reply, absent → determine + default
    // to reply (see copilotMode.ts). Optional so any caller that can't determine it still works.
    lastSpeaker: z.enum(["agent", "customer", "unknown"]).optional(),
    // When true, respond as a text/event-stream (the reply forms word-by-word in the panel) instead of one
    // JSON blob. Same prompt, same output — only the delivery differs. The client falls back to the non-stream
    // request on any stream failure, so this can never break the working path. Mirrors the Sales Coach fix
    // (2026-08-09); C.A.R.E keeps its OWN care voice — no sales charisma, no dash sanitizer.
    stream: z.boolean().optional(),
  })
  .strict();

const REASONING_MARKER = "===REASONING===";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function splitCopilot(raw: string): { reply: string; reasoning: string } {
  const idx = raw.indexOf(REASONING_MARKER);
  const reply = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const reasoning = idx >= 0 ? raw.slice(idx + REASONING_MARKER.length).trim() : "";
  return { reply, reasoning };
}

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "copilot", perUserMax: 20, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  const productContext = await getProductContextForTenant(user.companyId);

  // Agent identity anchor (Fix 2b, founder audit 2026-07-23 — Finding 2, role inversion). Without telling the
  // model WHO the agent is, an unlabeled thread makes it guess who's who — and it addressed the draft TO the
  // agent ("Hi John"). Look up the signed-in agent's name; fall back to a generic label so the draft never
  // blocks on the lookup. The WHO-IS-WHO rule in CO_PILOT_SYSTEM references this identity.
  let agentName = "the support agent";
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.userId)
      .maybeSingle();
    if (typeof prof?.full_name === "string" && prof.full_name.trim()) agentName = prof.full_name.trim();
  } catch {
    /* best-effort; the WHO-IS-WHO discipline still applies with the generic label */
  }

  // Response-MODE selection (founder request 2026-07-23). When the LAST message is the agent's own,
  // a "reply" would respond to the agent's own words — the mode must switch to a follow-up instead.
  // The signal comes from the adapter (DOM) where known; "unknown" makes the model determine it and
  // default to reply, so this never regresses today's behaviour (§1.5). Composes with the 2b anchor
  // below (TT.md A16 — both reference the same ${agentName}).
  const modeInstruction = copilotModeInstruction(body.lastSpeaker ?? "unknown", agentName);

  // Built once so the stream and non-stream deliveries send the SAME prompt (the co-pilot draft discipline
  // is identical; only the transport differs).
  const systemPrompt = `${CO_PILOT_SYSTEM}

You are drafting AS: ${agentName}. Messages from ${agentName} in the conversation are the agent's own words — write the next message from ${agentName}'s side, never addressed to ${agentName}.

${modeInstruction}

Product context the customer is reaching out about:
${productContext}`;
  const userMessage = `Conversation so far:\n${body.conversation}\n\nDraft ${agentName}'s next message to the customer, following the RESPONSE MODE above.`;

  // ── Streaming delivery ────────────────────────────────────────────────────────────────────────────────
  // The reply forms word-by-word in the panel. We stream raw content deltas; the client shows everything
  // before the ===REASONING=== marker as the forming reply, and on done we send the clean marker-split.
  // Company-less like the non-stream path (generateCareReply is called without companyId here), so this uses
  // llmStream directly. No sanitizer / voice change — C.A.R.E's output is unchanged, only streamed.
  if (body.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));
        try {
          let collected = "";
          for await (const delta of llmStream({
            systemPrompt,
            messages: [{ role: "user", content: userMessage }],
            maxTokens: 600,
          })) {
            collected += delta;
            send("delta", { text: delta });
          }
          const { reply, reasoning } = splitCopilot(collected);
          if (!reply) send("error", { error: "The Co-Pilot couldn't draft a reply right now. Try again." });
          else send("done", { reply, reasoning });
          controller.close();
        } catch (err) {
          const kind = err instanceof LlmError ? err.kind : undefined;
          if (!(err instanceof LlmError)) console.error("[care/extension/copilot stream] non-LLM failure:", err);
          send("error", { error: "The Co-Pilot couldn't draft a reply right now.", kind });
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
    const r = await generateCareReply({ systemPrompt, userMessage });
    const { reply, reasoning } = splitCopilot(r.text);
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
