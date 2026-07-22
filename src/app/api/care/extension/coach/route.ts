import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { getProductContextForTenant } from "@/lib/care/config";
import { analyzeCoachV5 } from "@/lib/claude";
import { buildSystemPrompt, buildUserMessage } from "@/lib/coach/v5/prompt";
import { loadCoachMemory, renderMemoryForPrompt } from "@/lib/coach/v5/memory";
import { validateCoachAnalysis } from "@/lib/coach/v5/validateAnalysis";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/care/extension/coach — Ask Coach ("grade a draft vs the books"), for the browser extension.
 *
 * Text-in ({ conversation, draft }) → { coach: CoachAnalysisResponse }: the agent's DRAFT reply is graded
 * against the communication Knowledge Base (Made to Stick, Never Split the Difference, NVC, …) exactly as the
 * in-app C.A.R.E "Ask Coach" does — SAME engine (analyzeCoachV5, contextType "support_reply"), SAME response
 * shape, SAME shared validator (validateCoachAnalysis, §3.4 no drift). The in-app surface resolves the thread
 * + customer message from a stored conversation-id; the text-in extension passes the scanned conversation as
 * the message being replied to.
 *
 * GATES: requireEntitledExtensionUser → per-user rate limit (Coach v5 burns tokens; matches the in-app 30/min).
 * DATA GOVERNANCE (D1 — ephemeral): conversation + draft are processed then DISCARDED.
 * CONTROL-WINDOW (§3.4 / A3): grades the user's OWN draft against an EXTERNAL conversation → guide-not-overtake
 * teaching on request, NOT the team's internal chain → NOT control-gated (see copilot route).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z
  .object({
    conversation: z.string().min(1).max(20_000),
    draft: z.string().min(1).max(8_000),
  })
  .strict();

export async function POST(req: NextRequest) {
  const preAuth = rateLimit(req, { id: "care-ext", windowMs: 60_000, max: 60 });
  if (preAuth) return preAuth;

  const gate = await requireEntitledExtensionUser(req);
  if (!gate.ok) return gate.response;

  const limited = rateLimit(req, {
    id: `care-ext-coach:${gate.user.userId}`,
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const body = await readBody(req, Schema);
  if (body instanceof NextResponse) return body;

  const productContext = await getProductContextForTenant(gate.user.companyId);

  try {
    const memory = await loadCoachMemory();
    const memoryBlock = renderMemoryForPrompt(memory);

    const systemPrompt = buildSystemPrompt({
      mode: "ask",
      contextType: "support_reply",
      memoryBlock,
    });
    const userMessage = buildUserMessage({
      draft: body.draft,
      contextType: "support_reply",
      contextPayload: {
        supportCustomerLastMessage: { author: "Customer", body: body.conversation },
        supportProductContext: productContext,
      },
    });

    // Not control-gated (external conversation, A3) — pass no companyId to the control window.
    const r = await analyzeCoachV5({ systemPrompt, userMessage });

    let parsed: unknown;
    try {
      parsed = JSON.parse(r.text);
    } catch {
      return NextResponse.json(
        { error: "Coach returned a malformed response. Please try again.", code: "malformed_response" },
        { status: 502 }
      );
    }

    const validated = validateCoachAnalysis(parsed);
    if (!validated) {
      return NextResponse.json(
        { error: "Coach returned an invalid response shape. Please try again.", code: "invalid_response_shape" },
        { status: 502 }
      );
    }

    return NextResponse.json({ coach: validated });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach couldn't grade that right now." },
      { status: 502 }
    );
  }
}
