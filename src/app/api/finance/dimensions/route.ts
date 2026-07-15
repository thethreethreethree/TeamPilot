import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { OPEN_PROBLEM_STATUSES } from "@/lib/data/problems";

/**
 * GET  /api/finance/dimensions — cost centers + projects + open problems (the tags for cost slicing).
 * POST /api/finance/dimensions — create one: { kind: "cost_center" | "project", code, name, ... }.
 *
 * PROBLEMS ARE A COST DIMENSION (0179). Tagging a bill line or an expense with the problem it was spent on
 * is the ONLY way cost-per-outcome can ever have data — the ledger cannot infer which problem a payment was
 * addressing, and inventing that attribution would be a fabricated number wearing a KPI's name.
 *
 * Only problems still IN PLAY are offered (draft/surfaceable/surfaced). You cannot spend money fixing a
 * problem that is already resolved or dismissed, and offering them would invite backdating cost onto a
 * closed outcome — which is precisely how a cost-per-outcome figure gets quietly improved.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ costCenters: [], projects: [], problems: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const [cc, pr, pb] = await Promise.all([
    sb.from("fin_cost_centers").select("id, code, name, parent_id, is_active").order("code"),
    sb.from("fin_projects").select("id, code, name, customer_id, status, budget").order("code"),
    sb
      .from("problems")
      .select("id, title, status")
      .in("status", OPEN_PROBLEM_STATUSES)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  return NextResponse.json({
    costCenters: cc.data ?? [],
    projects: pr.data ?? [],
    // Empty on error rather than 500 — a missing problem list must not break bill entry. The consequence
    // is a missing TAG, not a missing bill, and blocking the whole page would be the worse failure.
    problems: pb.error ? [] : (pb.data ?? []),
  });
}

const Body = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("cost_center"),
    code: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    parentId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("project"),
    code: z.string().min(1).max(40),
    name: z.string().min(1).max(120),
    customerId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    budget: z.number().nonnegative().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const companyId = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "No company." }, { status: 400 });
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  if (body.kind === "cost_center") {
    const { error } = await sb.from("fin_cost_centers").insert({
      company_id: companyId, code: body.code, name: body.name,
      parent_id: body.parentId ?? null, created_by: auth.user.id,
    });
    if (error) return NextResponse.json({ error: "Couldn't create cost center (duplicate code or no permission)." }, { status: 400 });
  } else {
    const { error } = await sb.from("fin_projects").insert({
      company_id: companyId, code: body.code, name: body.name,
      customer_id: body.customerId ?? null, start_date: body.startDate ?? null,
      budget: body.budget ?? null, created_by: auth.user.id,
    });
    if (error) return NextResponse.json({ error: "Couldn't create project (duplicate code or no permission)." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
