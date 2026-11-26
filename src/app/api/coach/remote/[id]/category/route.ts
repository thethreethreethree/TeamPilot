import { NextRequest, NextResponse } from "next/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { getSession } from "@/lib/data/salesCoach";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { currentCategories, type Pick } from "@/lib/coach/remote/callCategories";

/**
 * /api/coach/remote/:id/category — a phone/video call's category (2026-11-26, F10.10; migration 0367).
 *   GET  → { categoryId, name } | null — the latest pick, read through the caller's client (the call's access rule).
 *   POST { categoryId | null } → the call's OWN rep picks (or clears) it once the call is over (founder picker: "Rep
 *        picks at close", from the admin's list). A new pick is a new row; the latest wins.
 * The call is opened through the caller's client first, so nobody picks for a call they can't open.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = new Set(["PGRST205", "42P01"]);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-call-category", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const { data, error } = await db.from("call_category_picks").select("id, session_id, category_id").eq("session_id", id).order("id", { ascending: false }).limit(1);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false });
    console.error(`[call-category] read failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read the call's category." }, { status: 500 });
  }
  const cat = currentCategories((data ?? []) as Pick[]).get(id) ?? null;
  let name: string | null = null;
  if (cat) {
    const { data: c, error: cErr } = await db.from("call_categories").select("name").eq("id", cat).maybeSingle();
    if (cErr) {
      console.error(`[call-category] name read failed: ${cErr.message}`);
      return NextResponse.json({ error: "Couldn't read the call's category." }, { status: 500 });
    }
    name = (c?.name as string | undefined) ?? null;
  }
  return NextResponse.json({ available: true, category: cat ? { id: cat, name } : null, canPick: session.agentId === ctx.userId && isRemoteContext(session.context) && session.status !== "active" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { id: "remote-call-category-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { id } = await params;
  let b: { categoryId?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const categoryId = b.categoryId === null ? null : typeof b.categoryId === "string" && UUID.test(b.categoryId) ? b.categoryId : undefined;
  if (!UUID.test(id) || categoryId === undefined) return NextResponse.json({ error: "Which category?" }, { status: 400 });
  const db = callerScopedDb(req) ?? (await createClient());
  const session = await getSession(id, db);
  if (!session) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  if (session.agentId !== ctx.userId) return NextResponse.json({ error: "Only the rep on the call picks its category." }, { status: 403 });
  if (!isRemoteContext(session.context) || session.status === "active") return NextResponse.json({ error: "Pick a category once a phone or video call is over." }, { status: 400 });
  const admin = createAdminClient();
  if (categoryId) {
    const { data: c, error: cErr } = await admin.from("call_categories").select("id, retired_at").eq("company_id", session.companyId).eq("id", categoryId).maybeSingle();
    if (cErr) {
      if (MISSING.has(String(cErr.code))) return NextResponse.json({ error: "Call categories are waiting on database migration 0367." }, { status: 503 });
      console.error(`[call-category] category read failed: ${cErr.message}`);
      return NextResponse.json({ error: "Couldn't save the category." }, { status: 500 });
    }
    if (!c || c.retired_at) return NextResponse.json({ error: "That category isn't on the list any more." }, { status: 404 });
  }
  const { error } = await admin.from("call_category_picks").insert({ company_id: session.companyId, session_id: id, rep_id: session.agentId, category_id: categoryId, picked_by: ctx.userId });
  if (error) {
    console.error(`[call-category] insert failed session=${id}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the category." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, categoryId });
}
