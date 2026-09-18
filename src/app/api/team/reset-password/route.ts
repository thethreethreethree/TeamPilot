import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/roles";
import { generateTempPassword } from "@/lib/auth/tempPassword";

/**
 * POST /api/team/reset-password — an admin gives a locked-out teammate a new temporary password.
 *
 * WHY THIS EXISTS. A member who cannot sign in had exactly one route back in: /auth/forgot, an emailed link.
 * That flow depends on config the repo cannot hold (Supabase Site URL + the Redirect-URLs allowlist) and has
 * already failed silently in production once — the 2026-08-14 recovery outage recorded in docs/AUTH-REDIRECTS.md,
 * where reset links opened the marketing project instead of the form. When it fails, or when the email simply
 * does not arrive, the admin looking straight at that person in their team list had NO action available. The
 * escalation path became rep -> founder -> a service-role script run by hand, which happened three times for one
 * team on 2026-09-19. This is the missing step in that workflow (§1.5.1 layer 3: the admin's own flow dead-ended).
 *
 * Mirrors add-member mode "new": the credential is temporary by construction, because must_change_password is
 * set alongside it and the app forces the member to choose their own before they can use anything.
 *
 * The password is returned in the response body ONCE and never stored in plaintext by us — the admin passes it
 * on out-of-band, exactly as they already do with a team password.
 *
 * Admin-only, service-role (auth.admin + the guarded must_change_password column), company-pinned (INV15).
 */
export const maxDuration = 15;

const Body = z.object({ memberId: z.string().uuid() });

export async function POST(req: NextRequest) {
  // Tighter than set-role's 40/min: each call rotates a real credential, so a loose limit here is a way to
  // churn a colleague's password repeatedly.
  const limited = rateLimit(req, { id: "team-reset-password", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a team admin can reset a member's password." }, { status: 403 });

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  // Resetting your own password here would be a strictly worse path than Settings, where you prove you know the
  // current one. Refused so this endpoint is never the easy way to change your own credential.
  if (body.memberId === ctx.userId) {
    return NextResponse.json({ error: "Change your own password in Settings, not here." }, { status: 400 });
  }

  const sb = createAdminClient();

  // INV15 company-pin: a non-null row scoped to the caller's company IS the gate — an admin can never reach
  // another tenant's member.
  const { data: target } = await sb
    .from("profiles")
    .select("id, role, status, company_id, full_name")
    .eq("id", body.memberId)
    .maybeSingle();
  if (!target || (target.company_id as string | null) !== ctx.companyId) {
    return NextResponse.json({ error: "Member not found in your company." }, { status: 404 });
  }

  // A removed member must not be handed a working credential. Their access is supposed to be over; minting one
  // here would be re-admitting them through a side door.
  if ((target.status as string | null) === "removed") {
    return NextResponse.json(
      { error: "That member has been removed from the team. Re-add them instead of resetting their password." },
      { status: 409 },
    );
  }

  // PRIVILEGE GUARD. An admin resetting ANOTHER admin's password could take over that account — including the
  // owner's — and admin is already the top of this product's authority. So the reset is limited to non-admin
  // members, which is the case this feature was built for (a rep who cannot get in). An admin who is locked out
  // uses /auth/forgot, or another admin does it from the Supabase dashboard where the action is logged.
  // Deliberately conservative; widen only as an explicit founder decision.
  if (isAdminRole(target.role as string | null)) {
    return NextResponse.json(
      { error: "That member is an admin. Admin passwords can't be reset from here — use the forgot-password link." },
      { status: 403 },
    );
  }

  const password = generateTempPassword();

  const { error: pwErr } = await sb.auth.admin.updateUserById(body.memberId, { password });
  if (pwErr) {
    console.error(`[team/reset-password] auth update failed member=${body.memberId}: ${pwErr.message}`);
    return NextResponse.json({ error: "Couldn't reset that password." }, { status: 500 });
  }

  // Force the rotation. If this fails the password IS already changed, so say so honestly rather than reporting
  // a clean failure the admin would retry — the member's old password no longer works either way.
  const { error: flagErr } = await sb
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", body.memberId)
    .eq("company_id", ctx.companyId); // belt-and-suspenders tenant scope on the write itself
  if (flagErr) {
    console.error(`[team/reset-password] flag update failed member=${body.memberId}: ${flagErr.message}`);
    return NextResponse.json(
      {
        error: "The password was reset, but we couldn't force a change on first login. Share it and ask them to change it themselves.",
        password,
        mustChangeOnLogin: false,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    password,
    mustChangeOnLogin: true,
    fullName: (target.full_name as string | null) ?? null,
  });
}
