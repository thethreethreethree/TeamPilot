import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId, isAdminRole } from "@/lib/supabase/auth-helpers";
import { removeMember } from "@/lib/team/removeMember";
import { createAdminClient } from "@/lib/supabase/admin";
import { byOrgRank } from "@/lib/roles";
import { createInvitation } from "@/lib/team/createInvitation";

/**
 * GET    /api/team — list active members + pending invitations for the company
 * POST   /api/team — create an invitation { email, role } → returns the invite code
 * DELETE /api/team?invitationId=... — revoke a pending invitation
 * DELETE /api/team?memberId=...     — soft-remove an active member
 */

// Each failure carries its own status (2026-10-01): not signed in is a 401, a missing database a 503, an
// unfinished onboarding a 400. All three used to answer 400, so "not signed in" read as a bad request.
async function ctx() {
  if (!supabaseEnabled) return { error: "Live mode required.", status: 503 as const };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not authenticated", status: 401 as const };
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { error: "Complete onboarding first.", status: 400 as const };
  return { supabase, companyId, userId: auth.user.id };
}

export async function GET() {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });

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
    console.error("[team GET] failed to load members/invites:", membersRes.error ?? invitesRes.error);
    return NextResponse.json(
      { error: "Couldn't load the team." },
      { status: 500 }
    );
  }

  // Order the roster top-to-bottom by org hierarchy (founder directive) — the same ordering fetchTeam applies to
  // the server-rendered team page; this endpoint (its API twin, feeding the file-access + finance-cover pickers)
  // was left on created_at. byOrgRank ranks by tier then name; created_at no longer decides the order.
  const members = [...(membersRes.data ?? [])].sort(
    byOrgRank((m) => m.role as string | null, (m) => m.full_name as string | null)
  );

  return NextResponse.json({
    members,
    invitations: invitesRes.data,
  });
}

export async function POST(req: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });

  const { email, role } = await req.json().catch(() => ({}));
  // The whole invitation (escalation gate, duplicate checks, insert) lives in createInvitation, shared with the CSV
  // import so the two paths cannot drift (§2.2).
  const r = await createInvitation(c, email, role);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ invitationId: r.invitationId, code: r.code });
}

export async function DELETE(req: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });

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
    if (error) {
      console.error("[team PATCH] failed to revoke invitation:", error);
      return NextResponse.json({ error: "Couldn't revoke the invitation." }, { status: 500 });
    }
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
    // The rules live in removeMember (2026-11-26), shared with the team CSV import: company-pinned, never the last
    // active admin, and a write that touched no row is reported, not claimed.
    const r = await removeMember(createAdminClient(), c.companyId, c.userId, memberId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Provide invitationId or memberId in query." },
    { status: 400 }
  );
}
