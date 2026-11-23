import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { recordAudit } from "@/lib/audit/recordAudit";
import { setMfaFlag } from "@/lib/auth/mfaFlag";

/**
 * /api/me/mfa — the signed-in person's own authenticator apps (multi-factor sign-in, 2026-11-23).
 *   GET    → { factors: [{ id, name, status, createdAt }], on }
 *   POST   { name? } → starts enrolment: { factorId, qr, secret } — confirmed by POST /api/me/mfa/verify
 *   DELETE { factorId } → removes one (Supabase requires a session that has passed a code when one is verified)
 * Everything runs on the caller's own session; the service role only sets/clears the signed `app_metadata.mfa` flag
 * the guards read (lib/auth/mfa.ts).
 */
async function session() {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}

export async function GET() {
  const { sb, user } = await session();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) {
    console.error(`[mfa] list failed user=${user.id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load your sign-in methods." }, { status: 500 });
  }
  const factors = (data?.totp ?? []).map((f) => ({ id: f.id, name: f.friendly_name ?? "Authenticator app", status: f.status, createdAt: f.created_at }));
  return NextResponse.json({ factors, on: factors.some((f) => f.status === "verified") });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "mfa-enroll", windowMs: 60_000, max: 6 });
  if (limited) return limited;
  const { sb, user } = await session();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let name = "Authenticator app";
  try {
    const b = (await req.json()) as { name?: unknown };
    if (typeof b.name === "string" && b.name.trim()) name = b.name.trim().slice(0, 40);
  } catch {
    /* no body is fine */
  }
  // Supabase refuses a second factor with the same name; an unfinished earlier attempt is cleared first.
  const { data: existing } = await sb.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const taken = (existing?.totp ?? []).some((f) => f.friendly_name === name);
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: taken ? `${name} ${Date.now() % 10000}` : name });
  if (error || !data) {
    // Loud, with the provider's reason: the most likely cause is TOTP being switched off in the Supabase project (§1.5.3).
    console.error(`[mfa] enroll failed user=${user.id}: ${error?.message}`);
    return NextResponse.json(
      { error: "Couldn't start setup. If this keeps happening, sign-in codes may be switched off for this workspace — tell your admin." },
      { status: 502 },
    );
  }
  return NextResponse.json({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, { id: "mfa-remove", windowMs: 60_000, max: 6 });
  if (limited) return limited;
  const { sb, user } = await session();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  let factorId = "";
  try {
    factorId = String(((await req.json()) as { factorId?: unknown }).factorId ?? "");
  } catch {
    /* handled below */
  }
  if (!factorId) return NextResponse.json({ error: "Which authenticator?" }, { status: 400 });
  const { error } = await sb.auth.mfa.unenroll({ factorId });
  if (error) {
    // Supabase refuses removing a verified factor from a session that has not passed a code — the protection we want.
    console.error(`[mfa] unenroll refused user=${user.id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't remove it. Sign in again with a code first, then try." }, { status: 403 });
  }
  const { data: left } = await sb.auth.mfa.listFactors();
  const stillOn = (left?.totp ?? []).some((f) => f.status === "verified");
  const admin = createAdminClient();
  if (!stillOn) {
    const flagged = await setMfaFlag(admin, user.id, false);
    if (!flagged) return NextResponse.json({ error: "The authenticator was removed, but your account still asks for a code. Try again." }, { status: 500 });
    await sb.auth.refreshSession();
  }
  const { data: profile } = await admin.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (profile?.company_id) {
    await recordAudit(admin, { companyId: profile.company_id as string, actorId: user.id, action: "mfa.removed", objectType: "user", objectId: user.id, meta: { stillOn } });
  }
  return NextResponse.json({ ok: true, on: stillOn });
}
