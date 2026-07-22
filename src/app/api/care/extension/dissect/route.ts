import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
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
  const { body } = guard;

  const dissect = await generateConversationDissect({ sourceText: body.conversation });
  return NextResponse.json({ dissect });
}
