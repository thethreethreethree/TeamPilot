import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";

/**
 * Macro Mode per-rep toggle (founder decision 2026-08-18: per-rep, alongside the normal Sales Coach).
 *
 * GET  → { enabled } for the current rep.
 * POST { enabled } → flip the rep's own profiles.macro_mode_enabled (RLS "own profile - update" — a rep
 *   sets a feature-visibility flag on their OWN row; not a privileged column, 0090 is unaffected).
 */
const Body = z.object({ enabled: z.boolean() });

export async function GET(req: NextRequest) {
  // ONE substitution: the client. Declared GET() with no parameter, so it gains
  // `req` the same way kpi/team and my-training did.
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data } = await sb
    .from("profiles")
    .select("macro_mode_enabled")
    .eq("id", auth.user.id)
    .maybeSingle();
  return NextResponse.json({ enabled: Boolean(data?.macro_mode_enabled) });
}

export async function POST(req: NextRequest) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  /**
   * ROWS-AFFECTED DISCIPLINE, not just error-checking.
   *
   * `.update()` without a `.select()` returns no error AND no row count, so a write that matched
   * ZERO rows — an RLS filter declining it, a missing profile row — is indistinguishable from one
   * that landed. This route used to check only `error`, so it answered `{ enabled: true }` either
   * way: the toggle flipped on screen, the optimistic state stuck because the response was ok, and
   * the setting was back off on the next load. From the outside that is "the Macro Mode button is
   * broken", with nothing in any log.
   *
   * That is the false-ok write class this codebase has fixed repeatedly elsewhere — the member
   * removal that "did nothing" (A26's origin incident), the file delete/classify fixes, the chat
   * edit at chats.ts:1079 whose comment says it plainly: "A denied edit silently affects ZERO rows
   * (RLS filter, no error), so we verify the returned row."
   *
   * Returning the row means the answer is what the DATABASE now holds, not what the caller asked
   * for — so the client's optimistic state is corrected by fact rather than confirmed by an echo.
   */
  const { data: updated, error } = await sb
    .from("profiles")
    .update({ macro_mode_enabled: body.enabled })
    .eq("id", auth.user.id)
    .select("macro_mode_enabled")
    .maybeSingle();

  if (error) {
    // Logged in full server-side, generic to the client (CWE-209).
    console.error(`[macro-mode] update failed for user=${auth.user.id}:`, error.message);
    return NextResponse.json({ error: "Could not update Macro Mode." }, { status: 500 });
  }

  if (!updated) {
    console.error(
      `[macro-mode] update matched ZERO rows for user=${auth.user.id} — no profile row, or RLS declined it.`
    );
    return NextResponse.json(
      { error: "Macro Mode could not be saved to your profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({ enabled: Boolean(updated.macro_mode_enabled) });
}
