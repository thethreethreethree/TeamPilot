import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateStrongPassword } from "@/lib/auth/passwordPolicy";

/**
 * Team passwords (Add-agent upgrade, 2026-08-21). An admin-managed, titled, distributable shared credential: the
 * picked one becomes a brand-new user's initial login password (see /api/team/add-member). The admin can create
 * several (each titled), VIEW them (to hand out to the team), change, and soft-delete.
 *
 * Admin-only, service-role, company-pinned (INV15): company_id always comes from the caller's own session, never
 * the body. The `team_passwords` table has RLS-deny-all, so ALL access is through this route's service-role
 * client. The secret is returned to the admin BY DESIGN (they must be able to view it to distribute it).
 */
export const maxDuration = 15;

const CreateBody = z.object({ title: z.string().trim().min(1).max(80), secret: z.string().min(8).max(200) });
const PatchBody = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80).optional(),
  secret: z.string().min(8).max(200).optional(),
});
const DeleteBody = z.object({ id: z.string().uuid() });

async function requireAdmin() {
  const ctx = await getCurrentAuthContext();
  if (!ctx) return { error: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  if (!ctx.isAdmin) return { error: NextResponse.json({ error: "Only a team admin can manage team passwords." }, { status: 403 }) };
  return { ctx };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("team_passwords")
    .select("id, title, secret, created_at")
    .eq("company_id", gate.ctx.companyId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[team/passwords GET] failed:", error.message);
    return NextResponse.json({ error: "Couldn't load team passwords." }, { status: 500 });
  }
  return NextResponse.json({ passwords: data ?? [] });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-passwords-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const body = await readBody(req, CreateBody);
  if (body instanceof NextResponse) return body;

  const check = validateStrongPassword(body.secret);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("team_passwords")
    .insert({ company_id: gate.ctx.companyId, title: body.title, secret: body.secret, created_by: gate.ctx.userId })
    .select("id, title, secret, created_at")
    .single();
  if (error) {
    console.error("[team/passwords POST] failed:", error.message);
    return NextResponse.json({ error: "Couldn't create the team password." }, { status: 500 });
  }
  return NextResponse.json({ password: data });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-passwords-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;
  if (body.secret !== undefined) {
    const check = validateStrongPassword(body.secret);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  }
  const patch: Record<string, string> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (body.secret !== undefined) patch.secret = body.secret;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const sb = createAdminClient();
  // company_id pinned to the session (INV15) → a caller can only edit their OWN company's passwords.
  const { data, error } = await sb
    .from("team_passwords")
    .update(patch)
    .eq("id", body.id)
    .eq("company_id", gate.ctx.companyId)
    .is("revoked_at", null)
    .select("id, title, secret, created_at");
  if (error) {
    console.error("[team/passwords PATCH] failed:", error.message);
    return NextResponse.json({ error: "Couldn't update the team password." }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Team password not found." }, { status: 404 });
  return NextResponse.json({ password: data[0] });
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-passwords-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const body = await readBody(req, DeleteBody);
  if (body instanceof NextResponse) return body;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("team_passwords")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("company_id", gate.ctx.companyId)
    .is("revoked_at", null)
    .select("id");
  if (error) {
    console.error("[team/passwords DELETE] failed:", error.message);
    return NextResponse.json({ error: "Couldn't delete the team password." }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Team password not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
