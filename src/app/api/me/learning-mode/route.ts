import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/me/learning-mode
 * Returns the caller's `learning_mode_enabled` preference.
 *
 * PATCH /api/me/learning-mode
 * Mutates it.
 *
 * Per migration 0051 — preference is per-user, persisted, RLS-scoped
 * to the caller. The transient "is the lightbulb pulsing right now"
 * state is client-side and not persisted.
 */

const PatchSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }
  const { data } = await sb
    .from("profiles")
    .select("learning_mode_enabled")
    .eq("id", auth.user.id)
    .maybeSingle();
  return NextResponse.json({
    enabled: Boolean(data?.learning_mode_enabled),
  });
}

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
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
    .update({ learning_mode_enabled: body.enabled })
    .eq("id", auth.user.id)
    .select("learning_mode_enabled")
    .maybeSingle();
  if (error) {
    console.error("[me/learning-mode] failed to save preference:", error);
    return NextResponse.json({ error: "Couldn't save your learning-mode setting." }, { status: 500 });
  }
  if (!updated) {
    console.error(`[me/learning-mode] update matched ZERO rows for user=${auth.user.id}.`);
    return NextResponse.json({ error: "Couldn't save your learning-mode setting." }, { status: 500 });
  }
  // The stored value, not the requested one.
  return NextResponse.json({ ok: true, enabled: Boolean(updated.learning_mode_enabled) });
}
