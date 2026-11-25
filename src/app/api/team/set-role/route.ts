import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAssignableOrgRole } from "@/lib/roles";
import { setMemberRole } from "@/lib/team/setMemberRole";

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

  // The rules (company pin, last-admin safety, the scoped write) live in setMemberRole — shared with the team CSV import.
  const r = await setMemberRole(createAdminClient(), ctx.companyId, body.memberId, body.role);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, role: body.role });
}
