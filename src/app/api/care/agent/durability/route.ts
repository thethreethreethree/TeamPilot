import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  listDueDurabilityChecks,
  recordDurabilityOutcome,
} from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

async function requireAgent() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return { error: "Not authenticated.", status: 401 } as const;
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent || !profile?.company_id) {
    return { error: "Agent only.", status: 403 } as const;
  }
  return { companyId: profile.company_id };
}

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
  const ctx = await requireAgent();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const checks = await listDueDurabilityChecks(ctx.companyId);
  return NextResponse.json({ checks });
}

const Body = z.object({
  checkId: z.string().uuid(),
  outcome: z.enum(["held", "reopened", "inconclusive"]),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireAgent();
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
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
