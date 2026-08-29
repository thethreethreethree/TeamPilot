import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole, isAssignableOrgRole, ADMIN_ROLES } from "@/lib/roles";

/**
 * POST /api/team/set-role — set a team member's ORG ROLE / tier (founder 2026-08-29, org hierarchy stage 2).
 *
 * The tier IS the `role` field (the founder's choice), so this also determines admin authority: C-Suite roles are
 * admin (ADMIN_ROLES), everything below is not. Admin-only; service-role because `profiles.role` is a guarded
 * privileged column (0090/0091). Company-pinned (INV15): the target must be in the caller's company, and the write
 * is scoped by company_id so an admin can never touch another tenant's member.
 *
 * SAFETY: the change may not remove the company's LAST admin — demoting the only admin out of admin would lock the
 * company out of every admin surface, an unrecoverable state. That case is refused (409); promote someone first.
 */
export const maxDuration = 15;

const Body = z.object({
  memberId: z.string().uuid(),
  role: z.string().refine(isAssignableOrgRole, "Not an assignable org role."),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-set-role", windowMs: 60_000, max: 40 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a team admin can change roles." }, { status: 403 });

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = createAdminClient();

  // INV15 company-pin: the target must be in the caller's company. A non-null row scoped to company_id is the gate.
  const { data: target } = await sb
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", body.memberId)
    .maybeSingle();
  if (!target || (target.company_id as string | null) !== ctx.companyId) {
    return NextResponse.json({ error: "Member not found in your company." }, { status: 404 });
  }

  // Last-admin safety: refuse a demotion that would leave the company with zero admins.
  const wasAdmin = isAdminRole(target.role as string | null);
  const willBeAdmin = isAdminRole(body.role);
  if (wasAdmin && !willBeAdmin) {
    const { count } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", ctx.companyId)
      .in("role", [...ADMIN_ROLES]);
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "This is your company's only admin — promote someone to a C-Suite role first, then change this one." },
        { status: 409 },
      );
    }
  }

  const { error } = await sb
    .from("profiles")
    .update({ role: body.role })
    .eq("id", body.memberId)
    .eq("company_id", ctx.companyId); // belt-and-suspenders tenant scope on the write itself
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[team/set-role] update failed member=${body.memberId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't update the role." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role: body.role });
}
