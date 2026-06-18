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

  const { error } = await sb
    .from("profiles")
    .update({ learning_mode_enabled: body.enabled })
    .eq("id", auth.user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
