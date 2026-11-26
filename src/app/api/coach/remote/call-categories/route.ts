import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { checkName } from "@/lib/coach/remote/callCategories";

/**
 * /api/coach/remote/call-categories — the company's call categories (2026-11-26, F10.10; migration 0367).
 *   GET                        (anyone in the company) → the live categories, in the order they were added; canManage.
 *   POST  { name }             (company admins) → a new category (no duplicate names, at most 20).
 *   PATCH { id, retire: true } (company admins) → retired: no new picks; calls already in it keep it.
 * Founder picker 2026-11-26: the admin sets the list, the rep picks. Company-pinned (INV29). No customer data.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_READY = "Call categories are waiting on database migration 0367.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function live(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  return admin.from("call_categories").select("id, name, created_at").eq("company_id", companyId).is("retired_at", null).order("created_at", { ascending: true }).limit(100);
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-call-categories", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await live(createAdminClient(), ctx.companyId);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, reason: NOT_READY });
    console.error(`[call-categories] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load call categories." }, { status: 500 });
  }
  return NextResponse.json({ available: true, canManage: ctx.isAdmin === true, categories: ((data ?? []) as Array<{ id: string; name: string }>).map((c) => ({ id: c.id, name: c.name })) });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-call-categories-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can change call categories." }, { status: 403 });
  let b: { name?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: rows, error: rErr } = await live(admin, ctx.companyId);
  if (rErr) {
    if (MISSING.has(String(rErr.code))) return NextResponse.json({ error: NOT_READY }, { status: 503 });
    console.error(`[call-categories] read failed: ${rErr.message}`);
    return NextResponse.json({ error: "Couldn't add the category." }, { status: 500 });
  }
  const checked = checkName(b.name, ((rows ?? []) as Array<{ name: string }>).map((r) => r.name));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { data, error } = await admin.from("call_categories").insert({ company_id: ctx.companyId, name: checked.name, created_by: ctx.userId }).select("id").maybeSingle();
  if (error || !data) {
    console.error(`[call-categories] insert failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't add the category." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id, name: checked.name });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-call-categories-write", windowMs: 60_000, max: 20 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can change call categories." }, { status: 403 });
  let b: { id?: unknown; retire?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (typeof b.id !== "string" || !UUID.test(b.id) || b.retire !== true) return NextResponse.json({ error: "Which category to retire?" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("call_categories")
    .update({ retired_at: new Date().toISOString() })
    .eq("company_id", ctx.companyId)
    .eq("id", b.id)
    .is("retired_at", null)
    .select("id");
  if (error) {
    console.error(`[call-categories] retire failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't retire the category." }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
