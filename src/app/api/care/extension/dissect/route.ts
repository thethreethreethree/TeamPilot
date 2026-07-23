import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateConversationDissect } from "@/lib/dissect/engine";

/**
 * POST /api/care/extension/dissect — Dissect, for the C.A.R.E browser extension.
 *
 * Text-in → the full ConversationDissect (hasSignal, summary, problem, evidence, rootCause, outsideView,
 * anglesToConsider, guidingQuestion) — the SAME engine (generateConversationDissect) the in-app tool uses,
 * so there is no drift (§3.4). Honest-empty (hasSignal:false) when the text is too short — never a
 * fabricated problem (§0 / §3.4).
 *
 * Gates + rate limiting follow the audited pattern (A1/A2, 2026-07-22): coarse per-IP guard before auth,
 * per-USER limit after; requireEntitledExtensionUser rejects removed users + non-entitled tenants.
 * EPHEMERAL (D1): the scanned text is processed and NOT stored. Control-window: ungated product tool on
 * external conversations, like Summarize (A3 — pending founder ratification).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({ conversation: z.string().min(1).max(20_000) }).strict();

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "dissect", perUserMax: 20, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  // Agent identity anchor (A26 sweep — completes the tool class). The scanned thread is unlabeled, so
  // name the agent to keep the diagnosis from mis-attributing who raised each concern. Best-effort.
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

  const dissect = await generateConversationDissect({
    sourceText: body.conversation,
    agentName,
  });
  return NextResponse.json({ dissect });
}
