import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";
import { EXPERIENCE_MODES } from "@/lib/experience/mode";

/**
 * GET /api/me/experience-mode
 * Returns the caller's `experience_mode` ('standard' | 'expert').
 *
 * PATCH /api/me/experience-mode
 * Sets it.
 *
 * Per migration 0110 — a per-user, persisted, RLS-scoped preference (the same
 * shape as learning_mode_enabled). 'standard' simplifies AI-output verbosity +
 * collapses advanced UI; 'expert' is the full system. Non-privileged, so the
 * profiles self-update path sets it (the 0090/0091 guard leaves it alone).
 * The mode literal comes from @/lib/experience/mode (A13 vocabulary-once).
 */

const PatchSchema = z
  .object({
    mode: z.enum(EXPERIENCE_MODES),
  })
  .strict();

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data } = await sb
    .from("profiles")
    .select("experience_mode")
    .eq("id", auth.user.id)
    .maybeSingle();
  // Default to 'standard' if the row/column is somehow absent — the simplified
  // experience is the safe default for an unknown user (never over-serve complexity).
  const mode = data?.experience_mode === "expert" ? "expert" : "standard";
  return NextResponse.json({ mode });
}

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  const { error } = await sb
    .from("profiles")
    .update({ experience_mode: body.mode })
    .eq("id", auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, mode: body.mode });
}
