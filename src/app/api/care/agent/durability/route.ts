import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  listDueDurabilityChecks,
  recordDurabilityOutcome,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/agent/durability — list due checks.
 * POST — record an outcome for a check.
 *
 * Sprint 5 will add a background worker that auto-resolves "held"
 * for checks where the customer has had no new conversations or
 * relevant signals. For now the inbox surfaces due checks and an
 * agent decides.
 */
export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  const checks = await listDueDurabilityChecks(auth.companyId);
  return NextResponse.json({ checks });
}

const Body = z.object({
  checkId: z.string().uuid(),
  outcome: z.enum(["held", "reopened", "inconclusive"]),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  await recordDurabilityOutcome({
    checkId: body.checkId,
    outcome: body.outcome,
    notes: body.notes,
  });
  return NextResponse.json({ ok: true });
}
