import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { resolveRepName } from "@/lib/coach/extension/repName";
import { generateSalesSummary } from "@/lib/coach/extension/salesSummary";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/coach/extension/summarize — "Catch me up", for the Sales Coach browser extension.
 *
 * Text-in (conversation) → { summary }: a short honest read of where the deal stands, so a rep re-opening a
 * prospect thread can catch up before replying. Sales analogue of the C.A.R.E extension summarize.
 *
 * Gates reuse the shared, product-neutral guard (guardExtensionRequest): IP guard → entitlement → per-user
 * rate limit. EPHEMERAL — the scanned conversation is processed and NOT stored. The engine lets an LlmError
 * propagate so a provider rate-limit maps to 429 and any other failure to 502 — an empty summary would
 * dishonestly read as "nothing to summarize" (§3.4).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({ conversation: z.string().min(1).max(20_000) }).strict();

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "coach-summarize", perUserMax: 20, schema: Schema, productLabel: "Sales Coach extension" });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  // Rep identity anchor: a summary that swaps who-said-what is wrong, and the scanned thread has no
  // per-message role labels — name the rep so attribution is right. Best-effort; no-op with the generic label.
  const repName = await resolveRepName(user.userId);

  try {
    const summary = await generateSalesSummary({
      companyId: user.companyId,
      conversation: body.conversation,
      repName,
    });
    return NextResponse.json({ summary });
  } catch (err) {
    // A model rate-limit maps to 429 so the client backs off (matching the sibling routes); any other
    // failure is a 502. An empty summary is NOT returned — that would read as "nothing to summarize".
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
      );
    }
    console.error("[coach/extension/summarize] non-LLM failure:", err);
    return NextResponse.json({ error: "Couldn't summarize that right now." }, { status: 502 });
  }
}
