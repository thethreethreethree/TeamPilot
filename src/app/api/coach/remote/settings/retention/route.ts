import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { DEFAULT_KEEP_PER_REP, DEFAULT_RETENTION_DAYS, KEEP_MAX, KEEP_MIN, parseKeep } from "@/lib/coach/remote/retention";

/**
 * /api/coach/remote/settings/retention — how many recordings each rep keeps (RSS Phase 8, 0284; Gong F33.1; D14).
 * GET — anyone in the company: the current window, whether it is the default, and `canManage` (ctx.isAdmin — the
 *       same role set as admin_roles() in 0284's read rule) for the screen to branch on (§2.2).
 * PUT — company admins: { keepLastPerRep } appends a row (a change never overwrites, §3.1) and an audit row;
 *       { useDefault: true } appends a row with NO count = back to the standard 90 days (0308).
 * The purge cron reads the latest row per company; no row = DEFAULT_RETENTION_DAYS (90 days, D14 decided 2026-11-23).
 * `keepLastPerRep` is null on the default; `defaultKeep` is only the number the screen's box starts at.
 * Saved recordings are never purged, whatever the window.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_APPLIED = `The retention setting is waiting on database migration 0284. Until then recordings are kept for ${DEFAULT_RETENTION_DAYS} days.`;

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
  const base = { canManage: ctx.isAdmin, defaultKeep: DEFAULT_KEEP_PER_REP, defaultDays: DEFAULT_RETENTION_DAYS, min: KEEP_MIN, max: KEEP_MAX };
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ ...base, keepLastPerRep: null, isDefault: true, notReady: NOT_APPLIED });
    console.error(`[retention] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the retention setting." }, { status: 500 });
  }
  const row = (data ?? [])[0] as { keep_last_per_rep: number | null; set_by: string; created_at: string } | undefined;
  return NextResponse.json({
    ...base,
    keepLastPerRep: row?.keep_last_per_rep ?? null,
    // No row, or a latest row with no count (0308, "back to the standard") — both are the default.
    isDefault: row?.keep_last_per_rep == null,
    setAt: row?.created_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-retention-write", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can change retention." }, { status: 403 });
  let b: { keepLastPerRep?: unknown; useDefault?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  // Back to the standard is said explicitly ({ useDefault: true }), never inferred from a missing or null number — a
  // malformed request must not silently change how long a company's audio is kept.
  const useDefault = b.useDefault === true;
  const keep = useDefault ? null : parseKeep(b.keepLastPerRep);
  if (!useDefault && keep === null) return NextResponse.json({ error: `Pick a whole number from ${KEEP_MIN} to ${KEEP_MAX}.` }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("company_recording_settings")
    .insert({ company_id: ctx.companyId, keep_last_per_rep: keep, set_by: ctx.userId });
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    // 23502 = not-null violation: the count is still required, i.e. 0308 is not applied yet.
    if (useDefault && String(error.code) === "23502") {
      return NextResponse.json({ error: "Going back to the standard setting is waiting on database migration 0308." }, { status: 503 });
    }
    console.error(`[retention] write failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the retention setting." }, { status: 500 });
  }
  await recordAudit(admin, {
    companyId: ctx.companyId,
    actorId: ctx.userId,
    action: "retention.set",
    objectType: "company",
    objectId: ctx.companyId,
    meta: useDefault ? { useDefault: true, defaultDays: DEFAULT_RETENTION_DAYS } : { keepLastPerRep: keep },
  });
  return NextResponse.json({ keepLastPerRep: keep, isDefault: useDefault });
}
