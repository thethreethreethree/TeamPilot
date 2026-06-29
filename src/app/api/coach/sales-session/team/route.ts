import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";

/**
 * Sales Coach → Team management (Phase 3). Where sales_coach_role
 * (migration 0072) is first enforced.
 *
 * GET  → the company's members + their sales_coach_role, plus whether
 *        the caller is a MANAGER (can change roles).
 * POST → set a member's sales_coach_role (admin | staff | none).
 *        Manager-only.
 *
 * Manager = company admin (CEO/COO/admin) OR sales_coach_role='admin'.
 * The company-admin path is the BOOTSTRAP: initially no sales_coach_admin
 * exists, so a company admin assigns the first one (mirrors how C.A.R.E
 * lets company admins manage agents, §A21).
 *
 * §A18: roles only — no performance/ranking. §A10: this is configuration,
 * not surveillance.
 */

async function resolve() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401 as const };
  const { data: profile } = await sb
    .from("profiles")
    .select("role, company_id, sales_coach_role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile?.role as string | null) ?? null;
  const isCompanyAdmin = role === "CEO" || role === "COO" || role === "admin";
  const isManager = isCompanyAdmin || profile?.sales_coach_role === "admin";
  return {
    ok: true as const,
    sb,
    userId: auth.user.id,
    companyId: (profile?.company_id as string | null) ?? null,
    isManager,
  };
}

export async function GET() {
  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  const { data } = await ctx.sb
    .from("profiles")
    .select("id, full_name, role, sales_coach_role")
    .eq("company_id", ctx.companyId)
    .is("removed_at", null)
    .order("full_name", { ascending: true });
  return NextResponse.json({
    isManager: ctx.isManager,
    members: (data ?? []).map((m) => ({
      id: m.id,
      fullName: m.full_name,
      companyRole: m.role,
      salesCoachRole: m.sales_coach_role ?? null,
    })),
  });
}

const Body = z.object({
  id: z.string().uuid(),
  // null clears the role (no longer a Sales Coach user).
  salesCoachRole: z.enum(["admin", "staff"]).nullable(),
});

export async function POST(req: NextRequest) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await resolve();
  if (!ctx.ok) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!ctx.companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }
  if (!ctx.isManager) {
    return NextResponse.json(
      { error: "Only a Sales Coach admin (or a company admin) can manage the team." },
      { status: 403 }
    );
  }

  // Service-role update, scoped to the manager's company so a manager
  // can only change members of their own company.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ sales_coach_role: body.salesCoachRole })
    .eq("id", body.id)
    .eq("company_id", ctx.companyId);
  if (error) {
    return NextResponse.json(
      { error: "Couldn't update the role." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
