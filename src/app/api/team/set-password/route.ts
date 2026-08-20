import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateStrongPassword } from "@/lib/auth/passwordPolicy";

/**
 * Forced first-login password change (Add-agent upgrade, 2026-08-21). A user the admin created with a shared team
 * password lands here (the dashboard layout redirects while must_change_password is set). This sets their OWN
 * password AND clears the flag in ONE service-role operation — so the flag can only clear when the password is
 * actually reset (a user cannot self-clear must_change_password, per the 0235 guard). The caller must be the
 * authenticated user themselves; the new password must meet the team policy.
 */
export const maxDuration = 15;

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-set-password", windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const check = validateStrongPassword(body.password);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const sb = createAdminClient();
  // Set the caller's OWN password (id from the session, never the body).
  const { error: pwErr } = await sb.auth.admin.updateUserById(ctx.userId, { password: body.password });
  if (pwErr) {
    console.error("[team/set-password] updateUser failed:", pwErr.message);
    return NextResponse.json({ error: "Couldn't set your password. Please try again." }, { status: 500 });
  }
  // Clear the forced-change flag ONLY now that the password is set (service-role bypasses the 0235 guard).
  const { error: flagErr } = await sb
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", ctx.userId);
  if (flagErr) {
    // The password DID change; the flag will just keep them on this page until a retry clears it. Report so it
    // isn't a silent stuck-state, but the password change itself succeeded.
    console.error("[team/set-password] clear flag failed:", flagErr.message);
    return NextResponse.json({ error: "Your password was updated, but finishing failed — please try once more." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
