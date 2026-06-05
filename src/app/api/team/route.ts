import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { findAuthUserByEmail } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

const ROLES = ["CEO", "COO", "Lead", "Member"] as const;

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
  const safeRole =
    typeof role === "string" && (ROLES as readonly string[]).includes(role)
      ? role
      : "Member";
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
    .maybeSingle();
  if (existingInvite && new Date(existingInvite.expires_at) > new Date()) {
    return NextResponse.json(
      {
        error:
          "A pending invitation already exists for this email. Revoke it first if you want to reissue.",
      },
      { status: 409 }
    );
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
    const { error } = await c.supabase
      .from("team_invitations")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: c.userId,
        revoke_reason: reason,
      })
      .eq("id", invitationId)
      .is("accepted_at", null);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
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
    const { error } = await c.supabase
      .from("profiles")
      .update({ status: "removed", removed_at: new Date().toISOString() })
      .eq("id", memberId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { error: "Provide invitationId or memberId in query." },
    { status: 400 }
  );
}
