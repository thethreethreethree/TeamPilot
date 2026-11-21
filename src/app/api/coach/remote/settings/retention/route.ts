import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { DEFAULT_KEEP_PER_REP, KEEP_MAX, KEEP_MIN, parseKeep } from "@/lib/coach/remote/retention";

/**
 * /api/coach/remote/settings/retention — how many recordings each rep keeps (RSS Phase 8, 0284; Gong F33.1; D14).
 * GET — anyone in the company: the current window, whether it is the default, and `canManage` (ctx.isAdmin — the
 *       same role set as admin_roles() in 0284's read rule) for the screen to branch on (§2.2).
 * PUT — company admins: { keepLastPerRep } appends a row (a change never overwrites, §3.1) and an audit row.
 * The purge cron reads the latest row per company; no row = DEFAULT_KEEP_PER_REP (20), D14's stand-in.
 * Saved recordings are never purged, whatever the window.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_APPLIED = "The retention setting is waiting on database migration 0284. Until then each rep keeps their last 20.";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-retention-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from("company_recording_settings")
    .select("keep_last_per_rep, set_by, created_at")
    .eq("company_id", ctx.companyId)
    .order("id", { ascending: false })
    .limit(1);
  const base = { canManage: ctx.isAdmin, defaultKeep: DEFAULT_KEEP_PER_REP, min: KEEP_MIN, max: KEEP_MAX };
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ ...base, keepLastPerRep: DEFAULT_KEEP_PER_REP, isDefault: true, notReady: NOT_APPLIED });
    console.error(`[retention] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the retention setting." }, { status: 500 });
  }
  const row = (data ?? [])[0] as { keep_last_per_rep: number; set_by: string; created_at: string } | undefined;
  return NextResponse.json({
    ...base,
    keepLastPerRep: row?.keep_last_per_rep ?? DEFAULT_KEEP_PER_REP,
    isDefault: !row,
    setAt: row?.created_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-retention-write", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can change retention." }, { status: 403 });
  let b: { keepLastPerRep?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const keep = parseKeep(b.keepLastPerRep);
  if (keep === null) return NextResponse.json({ error: `Pick a whole number from ${KEEP_MIN} to ${KEEP_MAX}.` }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("company_recording_settings")
    .insert({ company_id: ctx.companyId, keep_last_per_rep: keep, set_by: ctx.userId });
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    console.error(`[retention] write failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the retention setting." }, { status: 500 });
  }
  await recordAudit(admin, {
    companyId: ctx.companyId,
    actorId: ctx.userId,
    action: "retention.set",
    objectType: "company",
    objectId: ctx.companyId,
    meta: { keepLastPerRep: keep },
  });
  return NextResponse.json({ keepLastPerRep: keep, isDefault: false });
}
