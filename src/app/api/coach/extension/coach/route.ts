import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { resolveRepName } from "@/lib/coach/extension/repName";
import { generateSalesReplyCoaching } from "@/lib/coach/extension/salesReplyCoach";

/**
 * POST /api/coach/extension/coach — "Coach my reply", for the Sales Coach browser extension.
 *
 * Text-in ({ conversation, draft }) → { coaching }: the rep's DRAFT reply is graded against the sales
 * methodology (SPIN / Challenger / Voss / Navigate 2.0 via the shared methodologyBlock) — what's strong,
 * what to improve (with the sales-principle WHY), a stronger revision of their OWN draft, and a §3.3
 * guiding question. The sales analogue of the C.A.R.E extension's "Ask Coach", grounded in the SALES books.
 *
 * Gates reuse the shared, product-neutral guard (guardExtensionRequest): IP guard → entitlement → per-user
 * rate limit (Coach v5 burns tokens; 30/min mirrors the in-app + C.A.R.E-extension coach). EPHEMERAL — the
 * conversation + draft are processed and NOT stored. Honest-empty on a trivial draft (§3.4).
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
  const guard = await guardExtensionRequest(req, { tool: "coach-reply", perUserMax: 30, schema: Schema, productLabel: "Sales Coach extension" });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  // Rep identity anchor: the scanned thread is unlabeled, so name the rep so the coach grades the draft
  // against a correctly-attributed context. Best-effort — a miss degrades, never fabricates.
  const repName = await resolveRepName(user.userId);

  const coaching = await generateSalesReplyCoaching({
    companyId: user.companyId,
    conversation: body.conversation,
    draft: body.draft,
    repName,
  });
  return NextResponse.json({ coaching });
}
