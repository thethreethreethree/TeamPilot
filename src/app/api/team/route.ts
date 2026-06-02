import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
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

  const { data, error } = await c.supabase
    .from("team_invitations")
    .insert({
      company_id: c.companyId,
      email: email.toLowerCase().trim(),
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
