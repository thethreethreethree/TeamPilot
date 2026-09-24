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

  const { data: updated, error } = await sb
    .from("profiles")
  /**
   * `.select(...).maybeSingle()` so a ZERO-ROW write is visible. Without it `.update()` returns no
   * error and no row count, so an RLS filter declining the write is indistinguishable from one
   * that landed — the route answers ok, the switch stays flipped on screen, and the setting is
   * back to its old value on the next load. Swept from the Macro Mode report (2026-09-24); five
   * routes on `profiles` shared this shape.
   */
    .update({ experience_mode: body.mode })
    .eq("id", auth.user.id)
    .select("experience_mode")
    .maybeSingle();
  if (error) {
    console.error("[me/experience-mode] failed to save preference:", error);
    return NextResponse.json({ error: "Couldn't save your experience-mode setting." }, { status: 500 });
  }
  if (!updated) {
    console.error(`[me/experience-mode] update matched ZERO rows for user=${auth.user.id}.`);
    return NextResponse.json({ error: "Couldn't save your experience-mode setting." }, { status: 500 });
  }
  // The stored value, not the requested one.
  return NextResponse.json({ ok: true, mode: updated.experience_mode });
}
