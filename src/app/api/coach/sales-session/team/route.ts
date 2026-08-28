import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { readBody } from "@/lib/api/validate";
import { byOrgRank } from "@/lib/roles";

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
  // Same single definition of "manager" as /list and the skills/recordings gates (A33 chokepoint). The two
  // routes agreed only by coincidence, and the Standard Sessions page trusts BOTH — /list decides whether the
  // page early-returns the manager view, /team decides what that view renders. Divergence would have shown a
  // manager a blank screen. Behaviour unchanged (the inline form was provably identical); the definition is now
  // unit-tested in one place.
  const isManager = isSalesCoachManager({
    role: (profile?.role as string | null) ?? null,
    sales_coach_role: (profile?.sales_coach_role as string | null) ?? null,
    company_id: (profile?.company_id as string | null) ?? null,
  });
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
  // Members + pending invites in one round-trip. The pending list lets the Team page show who's been invited but
  // hasn't joined yet, so the two-step (invite → assign Staff once they accept) is visible and trackable.
  const [membersRes, invitesRes] = await Promise.all([
    ctx.sb
      .from("profiles")
      .select("id, full_name, role, sales_coach_role")
      .eq("company_id", ctx.companyId)
      .is("removed_at", null)
      .order("full_name", { ascending: true }),
    ctx.sb
      .from("team_invitations")
      .select("id, email, invited_at, expires_at")
      .eq("company_id", ctx.companyId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("invited_at", { ascending: false }),
  ]);
  // Error-as-no-data guard: don't render an empty team / no-invites as if the company were empty on a read error.
  if (membersRes.error || invitesRes.error) {
    return NextResponse.json({ error: "Couldn't load the team." }, { status: 500 });
  }
  const now = Date.now();
  const pending = (invitesRes.data ?? [])
    .filter((i) => new Date(i.expires_at as string).getTime() > now) // hide expired (still occupy the slot until revoked)
    .map((i) => ({ id: i.id as string, email: i.email as string, invitedAt: i.invited_at as string }));
  // Order TOP-TO-BOTTOM by org rank (C-Suite → Frontline) on the COMPANY role, then A→Z within a tier (founder
  // 2026-08-29). The org hierarchy is the company role; sales_coach_role stays the per-product assignment.
  const orderedMembers = [...(membersRes.data ?? [])].sort(
    byOrgRank((m) => m.role as string | null, (m) => m.full_name as string | null)
  );
  return NextResponse.json({
    isManager: ctx.isManager,
    members: orderedMembers.map((m) => ({
      id: m.id,
      fullName: m.full_name,
      companyRole: m.role,
      salesCoachRole: m.sales_coach_role ?? null,
    })),
    // Least-disclosure: invitee emails go only to a manager (who can act on them), matching the UI gate that
    // hides the pending section from non-managers. Don't expose pending-invite emails via a direct API call.
    pendingInvites: ctx.isManager ? pending : [],
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
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ sales_coach_role: body.salesCoachRole })
    .eq("id", body.id)
    .eq("company_id", ctx.companyId)
    .select("id");
  if (error) {
    return NextResponse.json(
      { error: "Couldn't update the role." },
      { status: 500 }
    );
  }
  // §3.4 / strictUpdate: assert the write actually landed. 0 rows = the target
  // isn't in this manager's company — report it, don't claim a phantom success
  // (the same class as the team-removal false-ok bug, 558ce56).
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "That member isn't in your company." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
