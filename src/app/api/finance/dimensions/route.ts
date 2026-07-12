import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";

/**
 * GET  /api/finance/dimensions — cost centers + projects (the tags for cost/profit slicing).
 * POST /api/finance/dimensions — create one: { kind: "cost_center" | "project", code, name, ... }.
 */
export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ costCenters: [], projects: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const [cc, pr] = await Promise.all([
    sb.from("fin_cost_centers").select("id, code, name, parent_id, is_active").order("code"),
    sb.from("fin_projects").select("id, code, name, customer_id, status, budget").order("code"),
  ]);
  return NextResponse.json({ costCenters: cc.data ?? [], projects: pr.data ?? [] });
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
