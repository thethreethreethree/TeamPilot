import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { evaluate, type Attempt } from "@/lib/coach/remote/lockout";
import { NotDecidedError } from "@/lib/coach/remote/decisions";

/**
 * POST /api/auth/sign-in  { email, password } — password sign-in through the server (RSS Phase 0 step 7,
 * Gong F1.5; founder picker 2026-11-15 "Build the plan's server route").
 *
 * WHAT IT ADDS. Every attempt through our login pages is recorded in `login_attempts` (0272), and the lockout
 * rule (`lockout.ts`) runs BEFORE the password check. Until D4 sets numbers, `evaluate()` throws
 * NotDecidedError and sign-in carries on exactly as today (Supabase's own limits only) — so this route never
 * blocks anyone yet.
 *
 * WHAT IT DOES NOT DO, STATED SO NOBODY RELIES ON IT. The anon key is public, so anyone can call Supabase's
 * sign-in endpoint directly and never pass through here. A lockout enforced in this route stops people using
 * our login pages, not an attacker. Enforcement that cannot be skipped needs Supabase itself: its CAPTCHA (all
 * plans) or its password-verification hook (Team/Enterprise). Recorded in docs/tbc/2026-11-15-rss-p0.
 *
 * SESSION. The server Supabase client signs in and sets the same @supabase/ssr session cookies the browser
 * client would have set, so the login pages continue exactly as before after a 200.
 *
 * MESSAGES. Supabase's own auth message is returned as before (the login pages always showed err.message, e.g.
 * "Invalid login credentials"); a failure of THIS route is a generic 500, and the page then falls back to the
 * old direct sign-in so a fault here can never lock everyone out (src/lib/auth/signInViaServer.ts).
 */
export const maxDuration = 15;

const Body = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(1000),
});

const LOOKBACK_MS = 24 * 60 * 60 * 1000;

function clientIp(req: NextRequest): string | null {
  // Same order as rateLimit.ts: x-real-ip is set by the platform; x-forwarded-for's leftmost is client-supplied.
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || null;
}

/** Best-effort: a ledger failure must never fail or delay a sign-in beyond one insert. */
async function record(email: string, ip: string | null, succeeded: boolean): Promise<void> {
  try {
    const { error } = await createAdminClient().from("login_attempts").insert({ email, ip, succeeded });
    if (error) console.error(`[auth/sign-in] attempt not recorded: ${error.message}`);
  } catch (err) {
    console.error("[auth/sign-in] attempt not recorded:", err);
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "auth-sign-in", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const email = body.email.toLowerCase();
  const ip = clientIp(req);

  // Lockout BEFORE the password is checked. D4 undecided → NotDecidedError → continue, as the plan specifies.
  try {
    const since = new Date(Date.now() - LOOKBACK_MS).toISOString();
    const { data } = await createAdminClient()
      .from("login_attempts")
      .select("email, succeeded, created_at")
      .eq("email", email)
      .gte("created_at", since);
    const attempts: Attempt[] = ((data ?? []) as Array<{ email: string; succeeded: boolean; created_at: string }>).map((a) => ({
      email: a.email,
      succeeded: a.succeeded,
      at: new Date(a.created_at),
    }));
    const state = evaluate(attempts, new Date());
    if (state.locked) {
      await record(email, ip, false);
      return NextResponse.json(
        { error: `Too many failed sign-ins. Try again after ${state.until.toISOString().slice(11, 16)} UTC.`, locked: true },
        { status: 429 }
      );
    }
  } catch (err) {
    // D4 not decided (the normal case today), or the attempts read failed: sign-in proceeds on Supabase's limits.
    if (!(err instanceof NotDecidedError)) console.error("[auth/sign-in] lockout check skipped:", err);
  }

  let error: { message: string } | null = null;
  try {
    const supabase = await createClient();
    ({ error } = await supabase.auth.signInWithPassword({ email, password: body.password }));
  } catch (err) {
    console.error("[auth/sign-in] sign-in threw:", err);
    return NextResponse.json({ error: "Sign-in is unavailable right now." }, { status: 500 });
  }

  await record(email, ip, !error);
  if (error) {
    // Supabase's own message, as the login pages have always shown it.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
