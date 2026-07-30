import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * GET  /api/me/theme  — the caller's theme override + the company default + isAdmin.
 * PATCH /api/me/theme — { preference?, companyDefault? }
 *   - preference:   the caller's own override (null = inherit the company default). Self-RLS.
 *   - companyDefault: the company-wide default — ADMIN only, company-scoped.
 *
 * Substantial Settings (founder 2026-07-28): theme = company default + per-user override + DB
 * persistence. Modelled on /api/me/learning-mode (A28). Every DB touch is guarded (A34): if
 * migration 0201 has not been applied, the missing column degrades to null / a soft 409 and the
 * ThemeProvider keeps its localStorage-only behavior — nothing breaks.
 */

const THEME = z.enum(["system", "light", "dark"]);

const PatchSchema = z
  .object({
    preference: THEME.nullable().optional(),
    companyDefault: THEME.optional(),
  })
  .strict();

export async function GET() {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Per-user override (guarded — null if column 0201 not applied yet).
  let preference: "system" | "light" | "dark" | null = null;
  {
    const { data, error } = await sb
      .from("profiles")
      .select("theme_preference")
      .eq("id", ctx.userId)
      .maybeSingle();
    if (error && !isMissingColumnError(error, "theme_preference")) {
      // Real error — theme is cosmetic, so we don't 500 the whole ThemeProvider;
      // we flag it so the client can distinguish "unset" from "broken".
      return NextResponse.json({
        preference: null,
        companyDefault: null,
        isAdmin: ctx.isAdmin,
        degraded: true,
      });
    }
    preference = (data?.theme_preference as typeof preference) ?? null;
  }

  // Company default (guarded likewise).
  let companyDefault: "system" | "light" | "dark" | null = null;
  {
    const { data, error } = await sb
      .from("companies")
      .select("default_theme")
      .eq("id", ctx.companyId)
      .maybeSingle();
    if (!error) companyDefault = (data?.default_theme as typeof companyDefault) ?? null;
  }

  return NextResponse.json({ preference, companyDefault, isAdmin: ctx.isAdmin });
}

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  if (body.preference === undefined && body.companyDefault === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // 1. Per-user override — self only (RLS enforces id = auth.uid()).
  if (body.preference !== undefined) {
    const { error } = await sb
      .from("profiles")
      .update({ theme_preference: body.preference })
      .eq("id", ctx.userId);
    if (error) {
      if (isMissingColumnError(error, "theme_preference")) {
        return NextResponse.json(
          {
            error:
              "Theme persistence isn't available yet (migration 0201 pending). Your choice still applies on this device.",
          },
          { status: 409 }
        );
      }
      console.error("[me/theme] failed to save theme preference:", error);
      return NextResponse.json({ error: "Couldn't save your theme." }, { status: 500 });
    }
  }

  // 2. Company default — ADMIN only, company-scoped (founder: admin actions are company-scoped).
  if (body.companyDefault !== undefined) {
    if (!ctx.isAdmin) {
      return NextResponse.json(
        { error: "Only an admin can set the company default theme." },
        { status: 403 }
      );
    }
    const { error } = await sb
      .from("companies")
      .update({ default_theme: body.companyDefault })
      .eq("id", ctx.companyId);
    if (error) {
      if (isMissingColumnError(error, "default_theme")) {
        return NextResponse.json(
          { error: "Company theme default isn't available yet (migration 0201 pending)." },
          { status: 409 }
        );
      }
      console.error("[me/theme] failed to save company default theme:", error);
      return NextResponse.json({ error: "Couldn't save the company theme." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
