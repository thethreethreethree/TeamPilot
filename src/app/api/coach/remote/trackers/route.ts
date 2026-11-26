import { after, NextRequest, NextResponse } from "next/server";
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
import { cleanExamples, MAX_SMART_TRACKERS } from "@/lib/coach/remote/smartTrackers";
import { scanSmartTrackers } from "@/lib/coach/remote/smartTrackerScan";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";

/** A new smart tracker reads this many recent calls in the background (one AI read each), then new calls as they land. */
const SMART_BACKFILL_CALLS = 10;
export const maxDuration = 300;

/**
 * /api/coach/remote/trackers — keyword trackers (RSS Phase 3 step 3, Gong F11.1; migration 0276).
 *
 * GET   — anyone in the company: the trackers (active first) and `canManage`, the requireSalesCoachManager
 *         verdict the screen branches on (§2.2). Reps see the list: it says what their calls are listened for.
 * POST  — managers: { name, phrases[], side, kind? } creates one. kind "smart" (0329): `phrases` are example
 *         sentences (1–10, cleanExamples), at most MAX_SMART_TRACKERS active per company, and after saving the
 *         manager's last SMART_BACKFILL_CALLS visible sales calls are read for that tracker alone, in the background; { action: "scan" } matches the active trackers
 *         against the company's 50 most recent ended phone/video sales sessions this manager may see (a new
 *         tracker otherwise only applies to calls that land after it).
 * PATCH — managers: { id } deactivates one; { id, action: "publish" } puts a draft live (0352), once. A tracker is never
 *         edited or deleted (0276 trigger + rules). POST { …, draft: true } saves a draft: never matched or counted
 *         until it goes live, so it can be previewed first (F11.4).
 *
 * Writes use the service role (0276 has no client write policy), so the company is named in every statement.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_APPLIED = "Keyword trackers are waiting on database migration 0276.";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(60),
  phrases: z.array(z.string()).min(1).max(200),
  side: z.enum(["rep", "customer", "any"]).default("any"),
  kind: z.enum(["keyword", "smart"]).default("keyword"),
  // 0335: count only the first N minutes of a call (null/absent = the whole call). 0.5 to 60 minutes.
  withinFirstMinutes: z.number().min(0.5).max(60).nullable().optional(),
  // 0344 (F11.5): count only calls that started on or after startsOn and no later than endsOn (YYYY-MM-DD, UTC).
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // 0352 (F11.4): save without switching on.
  draft: z.boolean().optional(),
}).refine((b) => !b.startsOn || !b.endsOn || b.endsOn >= b.startsOn, { message: "The end date can't be before the start date." });
const ScanBody = z.object({ action: z.literal("scan") });
const PatchBody = z.object({ id: z.string().uuid(), action: z.enum(["off", "publish"]).default("off") });

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-trackers-read", windowMs: 60_000, max: 120 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const db = callerScopedDb(req) ?? (await createClient());
  const [{ data, error }, manager] = await Promise.all([
    db.from("keyword_trackers").select("id, name, phrases, side, kind, within_first_seconds, starts_on, ends_on, active, draft, created_at").order("active", { ascending: false }).order("name"),
    requireSalesCoachManager(req),
  ]);
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ available: false, reason: NOT_APPLIED, canManage: !!manager });
    console.error(`[remote/trackers] read failed: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load trackers." }, { status: 500 });
  }
  // A draft is the manager's work in progress (0352): reps see what their calls are listened for, which a draft isn't.
  const trackers = ((data ?? []) as Array<{ draft?: boolean }>).filter((t) => manager || !t.draft);
  return NextResponse.json({ available: true, trackers, canManage: !!manager });
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
  const smart = body.kind === "smart";
  let phrases: string[];
  try {
    phrases = smart ? cleanExamples(body.phrases) : normalisePhrases(body.phrases);
  } catch (e) {
    if (e instanceof TrackerError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  if (smart && !body.draft) {
    // The cap counts smart trackers that are ON (0352: live — a draft runs no AI reads).
    const { count, error: cErr } = await admin
      .from("keyword_trackers_live")
      .select("id", { count: "exact", head: true })
      .eq("company_id", manager.companyId)
      .eq("kind", "smart");
    if (cErr) {
      console.error(`[remote/trackers] smart count failed company=${manager.companyId}: ${cErr.message}`);
      return NextResponse.json({ error: "Couldn't save the tracker." }, { status: 500 });
    }
    if ((count ?? 0) >= MAX_SMART_TRACKERS)
      return NextResponse.json({ error: `Your company has ${MAX_SMART_TRACKERS} smart trackers on — switch one off to add another.` }, { status: 409 });
  }
  const { data, error } = await admin
    .from("keyword_trackers")
    .insert({
      company_id: manager.companyId,
      name: body.name,
      phrases,
      side: body.side,
      kind: body.kind,
      within_first_seconds: body.withinFirstMinutes != null ? Math.round(body.withinFirstMinutes * 60) : null,
      starts_on: body.startsOn ?? null,
      ends_on: body.endsOn ?? null,
      draft: body.draft === true,
      created_by: manager.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error && MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    console.error(`[remote/trackers] create failed: ${error?.message ?? "no row"}`);
    return NextResponse.json({ error: "Couldn't save the tracker." }, { status: 500 });
  }
  const id = String(data.id);
  if (!smart || body.draft) return NextResponse.json({ id, draft: body.draft === true }, { status: 201 });
  const backfilling = await queueSmartBackfill(req, admin, manager.companyId, id, body.startsOn ?? null, body.endsOn ?? null);
  return NextResponse.json({ id, backfilling }, { status: 201 });
}

/**
 * A smart tracker reads back the manager's most recent finished sales calls when it goes live (on create, or when a
 * draft is put live — 0352), after the response. Returns how many calls were queued.
 */
async function queueSmartBackfill(
  req: NextRequest,
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  id: string,
  startsOn: string | null,
  endsOn: string | null,
): Promise<number> {
  // Backfill: the manager's most recent finished sales calls (their reporting tree, like "scan"), read for this
  // tracker alone after the response — the list is chosen now, while the request's auth is in hand.
  // A dated tracker (0344) reads back only calls inside its dates (a past start date is "from then on").
  let rq = admin
    .from("coaching_sessions")
    .select("id, agent_id, session_kind")
    .eq("company_id", companyId)
    .in("context", ["phone", "video"])
    .neq("status", "active");
  if (startsOn) rq = rq.gte("started_at", `${startsOn}T00:00:00Z`);
  if (endsOn) rq = rq.lt("started_at", new Date(Date.parse(`${endsOn}T00:00:00Z`) + 86_400_000).toISOString());
  const { data: recent, error: rErr } = await rq.order("started_at", { ascending: false }).limit(SMART_BACKFILL_CALLS * 4);
  if (rErr) {
    console.error(`[remote/trackers] backfill list failed company=${companyId}: ${rErr.message}`);
    return 0;
  }
  const rows = ((recent ?? []) as Array<{ id: string; agent_id: string; session_kind: string | null }>).filter((r) => isSalesCall(r.session_kind ?? "sales"));
  const visible = new Set(await treeFilterReps(req, [...new Set(rows.map((r) => String(r.agent_id)))]));
  const calls = rows.filter((r) => visible.has(String(r.agent_id))).slice(0, SMART_BACKFILL_CALLS).map((r) => String(r.id));
  after(async () => {
    for (const sessionId of calls) await scanSmartTrackers(sessionId, admin, { onlyTrackerId: id });
  });
  return calls.length;
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-trackers-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const manager = await requireSalesCoachManager(req);
  if (!manager) return NextResponse.json({ error: "Only a manager can change trackers." }, { status: 403 });
  const body = await readBody(req, PatchBody);
  if (body instanceof NextResponse) return body;

  const admin = createAdminClient();
  if (body.action === "publish") {
    // A draft goes live (0352): only a draft that is still on; a smart one then reads back recent calls like a new one,
    // and counts toward the company's smart-tracker cap exactly as creating one live does.
    const { data: draft, error: dErr } = await admin.from("keyword_trackers").select("kind").eq("id", body.id).eq("company_id", manager.companyId).maybeSingle();
    if (dErr) {
      console.error(`[remote/trackers] publish read failed: ${dErr.message}`);
      return NextResponse.json({ error: "Couldn't put the tracker live." }, { status: 500 });
    }
    if (draft?.kind === "smart") {
      const { count, error: cErr } = await admin.from("keyword_trackers_live").select("id", { count: "exact", head: true }).eq("company_id", manager.companyId).eq("kind", "smart");
      if (cErr) {
        console.error(`[remote/trackers] smart count failed company=${manager.companyId}: ${cErr.message}`);
        return NextResponse.json({ error: "Couldn't put the tracker live." }, { status: 500 });
      }
      if ((count ?? 0) >= MAX_SMART_TRACKERS)
        return NextResponse.json({ error: `Your company has ${MAX_SMART_TRACKERS} smart trackers on — switch one off to put this one live.` }, { status: 409 });
    }
    const { data: t, error: pErr } = await admin
      .from("keyword_trackers")
      .update({ draft: false })
      .eq("id", body.id)
      .eq("company_id", manager.companyId)
      .eq("draft", true)
      .eq("active", true)
      .select("id, kind, starts_on, ends_on")
      .maybeSingle();
    if (pErr) {
      console.error(`[remote/trackers] publish failed: ${pErr.message}`);
      return NextResponse.json({ error: "Couldn't put the tracker live." }, { status: 500 });
    }
    if (!t) return NextResponse.json({ error: "That draft wasn't found (it may already be live or switched off)." }, { status: 404 });
    const backfilling =
      t.kind === "smart" ? await queueSmartBackfill(req, admin, manager.companyId, body.id, (t.starts_on as string | null) ?? null, (t.ends_on as string | null) ?? null) : 0;
    return NextResponse.json({ id: body.id, draft: false, backfilling });
  }
  const { data, error } = await admin
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
