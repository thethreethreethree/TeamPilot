import { NextRequest, NextResponse } from "next/server";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { dayIn } from "@/lib/coach/remote/revenue/daily";

/**
 * GET /api/coach/remote/deal-drivers?daysAgo=30|90[&repId=…|team] — the warnings recorded that night (0382
 * deal_warning_snapshots) for the pipeline in view: { day, rows: [{ rep_id, reasons }] }. Read through the caller's
 * client: the snapshots' RLS gives your own deals, or a manager's over the reps the tree allows. `rows` empty with
 * `recorded: false` means nothing was recorded that day (the nightly job wasn't running yet), said as that — never as
 * "no warnings".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-deal-drivers", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const daysAgo = Number(req.nextUrl.searchParams.get("daysAgo"));
  if (daysAgo !== 30 && daysAgo !== 90) return NextResponse.json({ error: "daysAgo is 30 or 90." }, { status: 400 });
  const asked = req.nextUrl.searchParams.get("repId");
  if (asked && asked !== "team" && !UUID.test(asked)) return NextResponse.json({ error: "Unknown rep." }, { status: 400 });
  const repId = asked === "team" ? null : asked || ctx.userId;
  const db = callerScopedDb(req) ?? (await createClient());
  // The company's own day, as the nightly job dates its record (revenue/daily.ts dayIn), then back daysAgo days.
  const { data: co } = await db.from("companies").select("timezone").eq("id", ctx.companyId).maybeSingle();
  const today = dayIn((co as { timezone?: string | null } | null)?.timezone ?? null, new Date());
  const day = new Date(Date.parse(`${today}T00:00:00Z`) - daysAgo * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await fetchAllPagedResult<{ id: number; rep_id: string; reasons: string[] }>(
    (f, t) => {
      let q = db.from("deal_warning_snapshots").select("id, rep_id, reasons").eq("day", day);
      if (repId) q = q.eq("rep_id", repId);
      return q.order("id").range(f, t);
    },
    { label: "warning snapshots" },
  );
  if (error) {
    console.error(`[deal-drivers] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't read the warnings recorded that day." }, { status: 500 });
  }
  const rows = (data ?? []).map((r) => ({ rep_id: r.rep_id, reasons: r.reasons }));
  return NextResponse.json({ day, recorded: rows.length > 0, rows });
}
