import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { NAME_MAX, parseSections, type Section } from "@/lib/coach/remote/briefTemplates";

/**
 * /api/coach/remote/brief-templates — a company's brief templates (2026-11-26, Gong F13.2; migration 0364).
 *   GET                         (anyone in the company) → the live templates, newest first.
 *   POST  { name, sections[] }  (managers) → a new template.
 *   PATCH { id, retire: true }  (managers) → retired: no new runs; answers already stored keep it.
 * A template changes by being retired and written again (the table's guard). Company-pinned (INV29). A template holds
 * no call or customer data — only a manager's questions.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Brief templates are waiting on database migration 0364.";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-brief-templates", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from("brief_templates")
    .select("id, name, sections, created_at")
    .eq("company_id", ctx.companyId)
    .is("retired_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, reason: NOT_READY });
    console.error(`[brief-templates] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load brief templates." }, { status: 500 });
  }
  const canManage = (await requireSalesCoachManager(req)) !== null;
  return NextResponse.json({
    available: true,
    canManage,
    templates: ((data ?? []) as Array<{ id: string; name: string; sections: Section[]; created_at: string }>).map((t) => ({ id: t.id, name: t.name, sections: t.sections, createdAt: t.created_at })),
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-brief-templates-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { name?: unknown; sections?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > NAME_MAX) return NextResponse.json({ error: `Give the template a name of up to ${NAME_MAX} characters.` }, { status: 400 });
  const parsed = parseSections(b.sections);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("brief_templates")
    .insert({ company_id: mgr.companyId, name, sections: parsed.sections, created_by: mgr.userId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[brief-templates] create failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't save the template." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-brief-templates-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const mgr = await requireSalesCoachManager(req);
  if (!mgr) return NextResponse.json({ error: "Managers only." }, { status: 403 });
  let b: { id?: unknown; retire?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (typeof b.id !== "string" || b.retire !== true) return NextResponse.json({ error: "Which template to retire?" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("brief_templates")
    .update({ retired_at: new Date().toISOString() })
    .eq("company_id", mgr.companyId)
    .eq("id", b.id)
    .is("retired_at", null)
    .select("id");
  if (error) {
    console.error(`[brief-templates] retire failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't retire the template." }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
