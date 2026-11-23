import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { setMfaFlag } from "@/lib/auth/mfaFlag";
import { isAdminRole } from "@/lib/roles";

/**
 * POST /api/team/mfa-reset { userId } — a company admin removes a member's authenticator apps, e.g. after a lost phone
 * (multi-factor sign-in, 2026-11-23). The member then signs in with their password alone and can set codes up again.
 * Admins only, members of the admin's own company only, never themselves or another admin (the same rule as a password
 * reset: one admin must not be able to strip another admin's second factor), audited.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "mfa-reset", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can reset sign-in codes." }, { status: 403 });
  let userId = "";
  try {
    userId = String(((await req.json()) as { userId?: unknown }).userId ?? "");
  } catch {
    /* handled below */
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: "Which member?" }, { status: 400 });

  const admin = createAdminClient();
  if (userId === ctx.userId) return NextResponse.json({ error: "Remove your own authenticator in Settings." }, { status: 400 });
  const { data: member, error: mErr } = await admin.from("profiles").select("id, role").eq("id", userId).eq("company_id", ctx.companyId).maybeSingle();
  if (mErr) return NextResponse.json({ error: "Couldn't check that member. Try again." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "That person isn't in your company." }, { status: 404 });
  if (isAdminRole(member.role as string | null)) return NextResponse.json({ error: "An admin's sign-in codes can't be reset by another admin." }, { status: 403 });

  const { data: list, error: lErr } = await admin.auth.admin.mfa.listFactors({ userId });
  if (lErr) {
    console.error(`[mfa-reset] list failed target=${userId}: ${lErr.message}`);
    return NextResponse.json({ error: "Couldn't read their sign-in methods. Try again." }, { status: 502 });
  }
  let removed = 0;
  for (const f of list?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ userId, id: f.id });
    if (error) {
      console.error(`[mfa-reset] delete failed target=${userId} factor=${f.id}: ${error.message}`);
      return NextResponse.json({ error: `Removed ${removed}, then one couldn't be removed. Try again.`, removed }, { status: 502 });
    }
    removed += 1;
  }
  const flagged = await setMfaFlag(admin, userId, false);
  if (!flagged) return NextResponse.json({ error: "Their authenticators were removed, but their account still asks for a code. Try again." }, { status: 500 });
  await recordAudit(admin, { companyId: ctx.companyId, actorId: ctx.userId, action: "mfa.reset", objectType: "user", objectId: userId, meta: { removed } });
  return NextResponse.json({ ok: true, removed });
}
