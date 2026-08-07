import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateSalesTextDissect } from "@/lib/coach/extension/salesTextDissect";

/**
 * POST /api/coach/extension/dissect — Dissect a sales conversation, for the Sales Coach browser extension.
 *
 * Text-in → a SALES read (what's working, the opportunity, the next move) grounded in the pasted thread.
 * Uses the text-in engine (generateSalesTextDissect) because the extension's only input is the raw text of
 * the conversation the rep is viewing on an external platform — the segment-based v5 sales dissect needs a
 * DB session and does not fit. Honest-empty (hasSignal:false) on a thin thread — never a fabricated read
 * (§0 / §3.4).
 *
 * Gates + rate limiting reuse the shared, product-neutral guard (guardExtensionRequest): coarse per-IP
 * guard before auth, per-USER limit after; requireEntitledExtensionUser rejects removed users +
 * non-entitled tenants — the SAME posture as the C.A.R.E extension routes. EPHEMERAL: the scanned text is
 * processed and NOT stored.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({ conversation: z.string().min(1).max(20_000) }).strict();

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "coach-dissect", perUserMax: 20, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  // Rep identity anchor: the scanned thread is unlabeled, so name the rep to keep the read from
  // mis-attributing the prospect's words to the rep. Best-effort — a miss degrades, never fabricates.
  let repName = "the sales rep";
  try {
    const admin = createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.userId)
      .maybeSingle();
    if (typeof prof?.full_name === "string" && prof.full_name.trim()) {
      repName = prof.full_name.trim();
    }
  } catch {
    /* best-effort */
  }

  const dissect = await generateSalesTextDissect({
    sourceText: body.conversation,
    repName,
  });
  return NextResponse.json({ dissect });
}
