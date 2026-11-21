import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { requireSalesCoachManager } from "@/lib/api/requireSalesCoachManager";
import { treeFilterReps } from "@/lib/api/treeAccess";
import { normalisePhrases, TrackerError } from "@/lib/coach/remote/trackers";
import { scanSessionTrackers } from "@/lib/coach/remote/trackerScan";

/**
 * /api/coach/remote/trackers — keyword trackers (RSS Phase 3 step 3, Gong F11.1; migration 0276).
 *
 * GET   — anyone in the company: the trackers (active first) and `canManage`, the requireSalesCoachManager
 *         verdict the screen branches on (§2.2). Reps see the list: it says what their calls are listened for.
 * POST  — managers: { name, phrases[], side } creates one; { action: "scan" } matches the active trackers
 *         against the company's 50 most recent ended phone/video sales sessions this manager may see (a new
 *         tracker otherwise only applies to calls that land after it).
 * PATCH — managers: { id } deactivates one. A tracker is never edited or deleted (0276 trigger + rules).
 *
 * Writes use the service role (0276 has no client write policy), so the company is named in every statement.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_APPLIED = "Keyword trackers are waiting on database migration 0276.";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(60),
  phrases: z.array(z.string()).min(1).max(200),
  side: z.enum(["rep", "customer", "any"]).default("any"),
});
const ScanBody = z.object({ action: z.literal("scan") });
const PatchBody = z.object({ id: z.string().uuid() });

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-trackers-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const db = callerScopedDb(req) ?? (await createClient());
  const [{ data, error }, manager] = await Promise.all([
    db.from("keyword_trackers").select("id, name, phrases, side, active, created_at").order("active", { ascending: false }).order("name"),
    requireSalesCoachManager(req),
  ]);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, reason: NOT_APPLIED, canManage: !!manager });
    console.error(`[remote/trackers] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load trackers." }, { status: 500 });
  }
  return NextResponse.json({ available: true, trackers: data ?? [], canManage: !!manager });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-trackers-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const manager = await requireSalesCoachManager(req);
  if (!manager) return NextResponse.json({ error: "Only a manager can change trackers." }, { status: 403 });

  const raw = (await req.clone().json().catch(() => null)) as { action?: unknown } | null;
  const admin = createAdminClient();

  if (raw?.action === "scan") {
    const body = await readBody(req, ScanBody);
    if (body instanceof NextResponse) return body;
    const { data: sessions, error } = await admin
      .from("coaching_sessions")
      .select("id, agent_id")
      .eq("company_id", manager.companyId)
      .in("context", ["phone", "video"])
      .neq("status", "active")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error(`[remote/trackers] scan list failed company=${manager.companyId}: ${error.message}`);
      return NextResponse.json({ error: "Couldn't list recent calls." }, { status: 500 });
    }
    const rows = (sessions ?? []) as Array<{ id: string; agent_id: string }>;
    // Reporting tree (RSS Phase 0 step 8): only calls of reps this manager may see.
    const visible = new Set(await treeFilterReps(req, [...new Set(rows.map((r) => String(r.agent_id)))]));
    let scanned = 0;
    let hits = 0;
    for (const r of rows) {
      if (!visible.has(String(r.agent_id))) continue;
      const n = await scanSessionTrackers(String(r.id), admin);
      scanned += 1;
      if (n) hits += n;
    }
    return NextResponse.json({ scanned, hits });
  }

  const body = await readBody(req, CreateBody);
  if (body instanceof NextResponse) return body;
  let phrases: string[];
  try {
    phrases = normalisePhrases(body.phrases);
  } catch (e) {
    if (e instanceof TrackerError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const { data, error } = await admin
    .from("keyword_trackers")
    .insert({ company_id: manager.companyId, name: body.name, phrases, side: body.side, created_by: manager.userId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    console.error(`[remote/trackers] create failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't save the tracker." }, { status: 500 });
  }
  return NextResponse.json({ id: String(data.id) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-trackers-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const manager = await requireSalesCoachManager(req);
  if (!manager) return NextResponse.json({ error: "Only a manager can change trackers." }, { status: 403 });
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;

  const { data, error } = await createAdminClient()
    .from("keyword_trackers")
    .update({ active: false })
    .eq("id", body.id)
    .eq("company_id", manager.companyId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error(`[remote/trackers] deactivate failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't switch the tracker off." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Tracker not found." }, { status: 404 });
  return NextResponse.json({ id: body.id, active: false });
}
