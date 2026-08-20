import type { createClient } from "@/lib/supabase/server";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

type SbClient = Awaited<ReturnType<typeof createClient>>;

/** A company's schedule date-math settings (RQ4 / RQ7). Defaults preserve the pre-0224 behavior. */
export interface ScheduleSettings {
  /** IANA timezone name for "today"; 'UTC' is the default. */
  timezone: string;
  /** Day the workweek starts, JS convention 0=Sun..6=Sat; 1 (Monday) is the default. */
  workweekStart: number;
  /** Custom title for the printed/downloaded schedule (0234). null = fall back to the company name. */
  scheduleName: string | null;
}

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = { timezone: "UTC", workweekStart: 1, scheduleName: null };

/** Trim + cap a custom schedule name; blank → null (so the export falls back to the company name). */
export const normalizeScheduleName = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t.slice(0, 60) : null;
};

const isValidTz = (tz: unknown): tz is string => {
  if (typeof tz !== "string" || !tz) return false;
  try {
    // Intl throws RangeError on an unknown IANA zone — reject it rather than crash the date math downstream.
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * Read a company's schedule settings (timezone + workweek-start). Migration-coupled: if the 0224 columns are
 * not applied yet, the select errors with a missing-column code — we detect THAT specifically and fall back
 * to the defaults (never assert the migration is applied). Any other error also falls back to defaults with a
 * log, because date math must not crash a schedule read over a settings lookup. An out-of-range or unknown
 * value is coerced to its default (defensive — the column has a CHECK, but a fallback path must be total).
 */
export async function getScheduleSettings(sb: SbClient, companyId: string): Promise<ScheduleSettings> {
  let data: unknown = null;
  let error: { message?: string; code?: string } | null = null;
  try {
    ({ data, error } = await sb
      .from("companies")
      .select("timezone, workweek_start, schedule_name")
      .eq("id", companyId)
      .maybeSingle());
  } catch (e) {
    // A settings lookup must NEVER break a schedule read — fall back to defaults on any thrown error.
    console.error("[schedule/settings] read threw, using defaults:", e instanceof Error ? e.message : e);
    return DEFAULT_SCHEDULE_SETTINGS;
  }

  if (error) {
    // Migration-coupled: any of the 0224/0234 columns missing → the whole select errors; detect THOSE
    // specifically and fall back to defaults quietly (never assert the migration is applied — A34).
    const known = isMissingColumnError(error, "timezone") || isMissingColumnError(error, "workweek_start") || isMissingColumnError(error, "schedule_name");
    if (!known) console.error("[schedule/settings] read failed, using defaults:", error.message);
    return DEFAULT_SCHEDULE_SETTINGS;
  }

  const row = (data ?? {}) as { timezone?: unknown; workweek_start?: unknown; schedule_name?: unknown };
  const timezone = isValidTz(row.timezone) ? row.timezone : DEFAULT_SCHEDULE_SETTINGS.timezone;
  const wkRaw = typeof row.workweek_start === "number" ? row.workweek_start : DEFAULT_SCHEDULE_SETTINGS.workweekStart;
  const workweekStart = Number.isInteger(wkRaw) && wkRaw >= 0 && wkRaw <= 6 ? wkRaw : DEFAULT_SCHEDULE_SETTINGS.workweekStart;
  return { timezone, workweekStart, scheduleName: normalizeScheduleName(row.schedule_name) };
}

/**
 * "Today" as YYYY-MM-DD in the given IANA timezone. Uses Intl (built-in, no dependency) — en-CA formats as
 * YYYY-MM-DD. Falls back to a UTC slice if the zone is somehow rejected (isValidTz guards the settings path,
 * so this is belt-and-braces). This is what a schedule "current/upcoming" filter should use — the server's
 * raw UTC date can be a day off near midnight for a non-UTC company.
 */
export function todayInTz(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
