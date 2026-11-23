import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { recordAudit } from "@/lib/audit/recordAudit";
import { setMfaFlag } from "@/lib/auth/mfaFlag";

/**
 * POST /api/me/mfa/verify { code, factorId? } — check a 6-digit authenticator code (multi-factor sign-in, 2026-11-23).
 *
 * One route for both moments:
 *  - finishing setup: `factorId` is the factor POST /api/me/mfa just created; a right code verifies it, the signed
 *    `app_metadata.mfa` flag is set, and the session is refreshed so the guards see it (and keep aal2);
 *  - signing in: no factorId; the person's verified authenticator is challenged, and a right code lifts this
 *    session to aal2 — the guards then let it through.
 * This path is exempt from the MFA guard (isMfaExempt) — it is the way through it. Rate-limited per client.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "mfa-verify", windowMs: 60_000, max: 8 });
  if (limited) return limited;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Your sign-in has expired. Sign in again." }, { status: 401 });

  let body: { code?: unknown; factorId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });

  const { data: list, error: listErr } = await sb.auth.mfa.listFactors();
  if (listErr) return NextResponse.json({ error: "Couldn't check your sign-in methods. Try again." }, { status: 500 });
  const setup = typeof body.factorId === "string" && body.factorId ? body.factorId : null;
  const factor = setup
    ? (list?.all ?? []).find((f) => f.id === setup && f.factor_type === "totp")
    : (list?.totp ?? []).find((f) => f.status === "verified");
  if (!factor) return NextResponse.json({ error: setup ? "That setup has expired. Start again." : "No authenticator is set up on this account." }, { status: 404 });

  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return NextResponse.json({ error: "That code didn't match. Check the time on your phone and try the newest code." }, { status: 400 });

  const admin = createAdminClient();
  if (setup || user.app_metadata?.mfa !== true) {
    // First confirmation (or a flag that was never written): turn the guard on for this account, then refresh so the
    // signed token carries it. Fail loud: an authenticator the guard doesn't know about protects nothing.
    const flagged = await setMfaFlag(admin, user.id, true);
    if (!flagged) return NextResponse.json({ error: "Your code was right, but turning on the requirement failed. Try again." }, { status: 500 });
    await sb.auth.refreshSession();
    const { data: profile } = await admin.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    if (profile?.company_id) {
      await recordAudit(admin, { companyId: profile.company_id as string, actorId: user.id, action: "mfa.enabled", objectType: "user", objectId: user.id, meta: {} });
    }
  }
  return NextResponse.json({ ok: true });
}
