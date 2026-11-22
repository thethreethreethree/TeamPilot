import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";

/**
 * Remote Sales Macro Mode — the rep's own switch (docs/rss/MACRO-MODE-SPEC.md, 0303). Same shape as Sales Coach's
 * (/api/coach/sales-session/macro-mode, 0219) and deliberately a SEPARATE column: the founder required Remote Sales
 * to be fully separate from Sales Coach, so turning one on never changes the other.
 *
 * GET  → { enabled } for the signed-in person.
 * POST { enabled } → set it on their OWN profile row (RLS "own profile - update"); the answer is what the database
 *   now holds (rows-affected discipline — a zero-row write is an error, not an echo).
 */
const Body = z.object({ enabled: z.boolean() });

export async function GET(req: NextRequest) {
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await sb.from("profiles").select("remote_macro_mode_enabled").eq("id", auth.user.id).maybeSingle();
  if (error) {
    // Before 0303 the column does not exist: say "off", which is the true state of a feature not installed yet.
    if (error.code === "42703") return NextResponse.json({ enabled: false, available: false });
    console.error(`[remote-macro-mode] read failed user=${auth.user.id}: ${error.message}`);
    return NextResponse.json({ error: "Could not read Macro Mode." }, { status: 500 });
  }
  return NextResponse.json({ enabled: Boolean(data?.remote_macro_mode_enabled), available: true });
}

export async function POST(req: NextRequest) {
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: updated, error } = await sb
    .from("profiles")
    .update({ remote_macro_mode_enabled: body.enabled })
    .eq("id", auth.user.id)
    .select("remote_macro_mode_enabled")
    .maybeSingle();
  if (error) {
    console.error(`[remote-macro-mode] update failed user=${auth.user.id}: ${error.message}`);
    return NextResponse.json({ error: "Could not update Macro Mode." }, { status: 500 });
  }
  if (!updated) {
    console.error(`[remote-macro-mode] update matched ZERO rows user=${auth.user.id}`);
    return NextResponse.json({ error: "Macro Mode could not be saved to your profile." }, { status: 500 });
  }
  return NextResponse.json({ enabled: Boolean(updated.remote_macro_mode_enabled) });
}
