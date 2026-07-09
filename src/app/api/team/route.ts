import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId, isAdminRole } from "@/lib/supabase/auth-helpers";
import { findAuthUserByEmail, createAdminClient } from "@/lib/supabase/admin";
import { isInvitableRole } from "@/lib/roles";
import { randomBytes } from "crypto";

function genCode(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * GET    /api/team — list active members + pending invitations for the company
 * POST   /api/team — create an invitation { email, role } → returns the invite code
 * DELETE /api/team?invitationId=... — revoke a pending invitation
 * DELETE /api/team?memberId=...     — soft-remove an active member
 */

async function ctx() {
  if (!supabaseEnabled) return { error: "Live mode required." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated" };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { error: "Complete onboarding first." };
  return { supabase, companyId, userId: auth.user.id };
}

export async function GET() {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });

  const [membersRes, invitesRes] = await Promise.all([
    c.supabase
      .from("profiles")
      .select("id, full_name, role, status, removed_at, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    c.supabase
      .from("team_invitations")
      .select(
        "id, email, role, code, invited_at, expires_at, accepted_at, revoked_at"
      )
      .order("invited_at", { ascending: false }),
  ]);

  if (membersRes.error || invitesRes.error) {
    return NextResponse.json(
      { error: (membersRes.error ?? invitesRes.error)?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    members: membersRes.data,
    invitations: invitesRes.data,
  });
}

export async function POST(req: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });

  const { email, role } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email required." },
      { status: 400 }
    );
  }
  const safeRole = isInvitableRole(role) ? role : "Member";
  const normalizedEmail = email.toLowerCase().trim();

  // Duplicate-prevention #1: an active pending invitation for this
  // email in this company. Two invitations to the same email produce
  // confusing state (two copy-links, two journeys) — reject early with
  // a clear message so the inviter knows to use the existing one.
  const { data: existingInvite } = await c.supabase
    .from("team_invitations")
    .select("id, expires_at")
    .eq("company_id", c.companyId)
    .eq("email", normalizedEmail)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("invited_at", { ascending: false })
    // .limit(1) BEFORE .maybeSingle(): there is no unique constraint on
    // (company_id, email) for pending invites, so 2+ can exist. Without the
    // limit, .maybeSingle() ERRORS on multiple rows → data is null → this
    // duplicate-prevention guard silently SKIPS, letting yet another duplicate be
    // created (the guard defeated by the very duplicates it exists to prevent).
    // A DB partial-unique index is the structural fix — see the remediation plan.
    .limit(1)
    .maybeSingle();
  if (existingInvite) {
    if (new Date(existingInvite.expires_at) > new Date()) {
      // A LIVE pending invite exists → reject (unchanged behaviour).
      return NextResponse.json(
        {
          error:
            "A pending invitation already exists for this email. Revoke it first if you want to reissue.",
        },
        { status: 409 }
      );
    }
    // F3 (audit 2026-07-10): the existing invite is EXPIRED but still occupies the
    // (company_id, lower(email)) partial-unique slot — 0098's index predicate is
    // `accepted_at is null and revoked_at is null`, and expiry is NOT in it (now()
    // can't live in an index predicate). The old code fell straight through to the
    // insert here and hit a raw unique-violation → 500. Auto-revoke the expired
    // invite first so re-inviting works AND the app agrees with the index (A16 —
    // two enforcement layers must compose). The DB index remains the backstop for
    // the concurrent-double-POST race.
    await c.supabase
      .from("team_invitations")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: c.userId,
        revoke_reason: "Superseded — prior invite expired, re-invited",
      })
      .eq("id", existingInvite.id)
      .is("accepted_at", null);
  }

  // Duplicate-prevention #2: the email already belongs to an active
  // member of this company. Without this check the System happily
  // creates a redundant invitation for someone who's already in the
  // company (the exact case the user hit when re-inviting accounts
  // we'd seeded via script). Catching it requires auth.users access,
  // which only the service-role admin client has.
  const authUser = await findAuthUserByEmail(normalizedEmail);
  if (authUser) {
    const { data: existingMember } = await c.supabase
      .from("profiles")
      .select("id, full_name, status")
      .eq("id", authUser.id)
      .eq("company_id", c.companyId)
      .maybeSingle();
    if (existingMember && existingMember.status === "active") {
      return NextResponse.json(
        {
          error: `${existingMember.full_name ?? normalizedEmail} is already a member of this company.`,
        },
        { status: 409 }
      );
    }
  }

  const { data, error } = await c.supabase
    .from("team_invitations")
    .insert({
      company_id: c.companyId,
      email: normalizedEmail,
      role: safeRole,
      code: genCode(),
      invited_by: c.userId,
    })
    .select("id, code")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invitationId: data.id, code: data.code });
}

export async function DELETE(req: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 400 });

  const url = new URL(req.url);
  const invitationId = url.searchParams.get("invitationId");
  const memberId = url.searchParams.get("memberId");

  if (invitationId) {
    const reason =
      url.searchParams.get("reason") ?? "Revoked by company admin";
    // §3.4 / strictUpdate (audit 2026-07-09): assert a row was actually revoked.
    // This is the SIBLING of the member-removal false-ok fixed below in the same
    // route — it checked `error` only, so revoking a nonexistent id, an
    // already-accepted invite (excluded by .is("accepted_at", null)), or an
    // RLS-blocked one matched 0 rows and FALSELY replied ok:true. The dangerous case:
    // a "revoked" invitation that is actually still LIVE — the admin thinks it's dead,
    // the invitee can still accept. Add .select + a rowcount check to report honestly.
    const { data: revoked, error } = await c.supabase
      .from("team_invitations")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: c.userId,
        revoke_reason: reason,
      })
      .eq("id", invitationId)
      .is("accepted_at", null)
      .select("id");
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!revoked || revoked.length === 0) {
      return NextResponse.json(
        {
          error:
            "That invitation couldn't be revoked — it doesn't exist, was already accepted, or was already revoked.",
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (memberId) {
    // Prevent removing self — should use a different flow for "leave company"
    if (memberId === c.userId) {
      return NextResponse.json(
        { error: "Cannot remove yourself from the company via this route." },
        { status: 400 }
      );
    }
    // Removing a teammate is an ADMIN action on ANOTHER user's profile row. The
    // user-scoped client CANNOT perform it: the profiles UPDATE RLS policy is
    // self-only (0001: `using (id = auth.uid())`), so the soft-remove matched 0
    // rows, returned NO error, and the route FALSELY replied ok — the "removed
    // member stays in the list" bug (founder-reported 2026-07-07). Mirror the care
    // agent-toggle route (care/agent/settings/agents): (1) verify the caller is a
    // company admin, (2) write via the service-role admin client scoped to the
    // caller's OWN company, (3) ASSERT a row was actually affected (§3.4 /
    // strictUpdate — never claim a write that didn't land).
    //
    // The admin gate is now LOAD-BEARING: the admin client bypasses RLS, so without
    // it any member could remove anyone. The old code was safe only by RLS accident
    // (it silently no-op'd for everyone), which is exactly why the bug hid.
    const { data: me } = await c.supabase
      .from("profiles")
      .select("role")
      .eq("id", c.userId)
      .maybeSingle();
    if (!isAdminRole(me?.role as string | null | undefined)) {
      return NextResponse.json(
        { error: "Only a company admin can remove a member." },
        { status: 403 }
      );
    }
    const admin = createAdminClient();
    const { data: removed, error } = await admin
      .from("profiles")
      .update({ status: "removed", removed_at: new Date().toISOString() })
      .eq("id", memberId)
      .eq("company_id", c.companyId) // scope to the admin's own company
      .select("id");
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!removed || removed.length === 0) {
      // 0 rows = the target isn't in this admin's company (or was already removed).
      // Report honestly instead of a phantom success.
      return NextResponse.json(
        { error: "That member isn't in your company, or was already removed." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Provide invitationId or memberId in query." },
    { status: 400 }
  );
}
