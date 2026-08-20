import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { getScheduleSettings, normalizeScheduleName } from "@/lib/schedule/settings";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

/**
 * Schedule Management System — company schedule settings (RQ4 / RQ7): timezone + workweek-start.
 *
 * GET returns the current settings (with the guarded fallback to UTC/Monday if the 0224 columns aren't
 * applied). PATCH sets them — manager-only, scoped to the caller's OWN company (company_id from the session,
 * never a parameter — INV15). These drive what "today" is and where the workweek/payroll week begins for the
 * hours cap + the grid.
 */
export const maxDuration = 15;

const Body = z.object({
  timezone: z.string().min(1).max(64).refine((tz) => {
    try { new Intl.DateTimeFormat("en-CA", { timeZone: tz }); return true; } catch { return false; }
  }, "not a valid IANA timezone"),
  workweekStart: z.number().int().min(0).max(6),
  // Custom export title (0234). Empty/blank/absent → null (fall back to the company name).
  scheduleName: z.string().max(60).nullable().optional(),
});

export async function GET() {
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const sb = await createClient();
  return NextResponse.json(await getScheduleSettings(sb, ctx.companyId));
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { id: "schedule-settings", windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a manager can change schedule settings." }, { status: 403 });

  const scheduleName = normalizeScheduleName(body.scheduleName);
  const sb = await createClient();
  // company_id pinned to the session (INV15) — a manager can only set their OWN company's settings.
  let { error } = await sb
    .from("companies")
    .update({ timezone: body.timezone, workweek_start: body.workweekStart, schedule_name: scheduleName })
    .eq("id", ctx.companyId);

  // Migration-coupled DEGRADE (A34): only schedule_name (0234) is new. If that column isn't applied yet, the
  // write must NOT take timezone/workweek_start down with it — retry saving just the pre-0234 columns, and tell
  // the manager HONESTLY that the name couldn't be saved (a setup step), rather than silently dropping it.
  let nameSaved = true;
  if (error && isMissingColumnError(error, "schedule_name")) {
    nameSaved = false;
    ({ error } = await sb
      .from("companies")
      .update({ timezone: body.timezone, workweek_start: body.workweekStart })
      .eq("id", ctx.companyId));
  }
  if (error) {
    console.error("[schedule/settings] update failed:", error.message);
    return NextResponse.json({ error: "Couldn't save settings." }, { status: 500 });
  }
  return NextResponse.json({
    timezone: body.timezone,
    workweekStart: body.workweekStart,
    scheduleName: nameSaved ? scheduleName : null,
    ...(nameSaved ? {} : { notice: "Timezone and workweek saved. The custom schedule name needs a database update (migration 0234) that isn't applied yet, so it wasn't saved — the export uses your company name until then." }),
  });
}
