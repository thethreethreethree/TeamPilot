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
  const { error } = await sb
    .from("profiles")
    .update({ macro_mode_enabled: body.enabled })
    .eq("id", auth.user.id);
  if (error) return NextResponse.json({ error: "Could not update Macro Mode." }, { status: 500 });
  return NextResponse.json({ enabled: body.enabled });
}
