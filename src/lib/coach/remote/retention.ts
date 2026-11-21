import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";

/**
 * Recording retention per company (RSS Phase 8, migration 0284; Gong F33.1; decision D14).
 *
 * D14 is open; its stand-in is today's behaviour: no setting means each rep keeps their last 20 recordings
 * (founder 2026-08-26, "save last 20 recordings"). This file is the ONE place that number lives — the purge cron and
 * the settings route both read it from here, so the default cannot drift between what the screen promises and what
 * the cron deletes.
 *
 * A setting is a row; the latest row per company is current (§3.1: a change never overwrites).
 */
export const DEFAULT_KEEP_PER_REP = 20;
export const KEEP_MIN = 1;
export const KEEP_MAX = 1000;

const TABLE_MISSING = new Set(["PGRST205", "42P01"]);

export function parseKeep(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= KEEP_MIN && n <= KEEP_MAX ? n : null;
}

type Row = { id: number; company_id: string; keep_last_per_rep: number; set_by?: string | null; created_at?: string };

/** The latest row per company. Rows may arrive in any order. Pure. */
export function latestPerCompany(rows: Row[]): Map<string, Row> {
  const out = new Map<string, Row>();
  for (const r of rows) {
    const cur = out.get(String(r.company_id));
    if (!cur || Number(r.id) > Number(cur.id)) out.set(String(r.company_id), r);
  }
  return out;
}

export function keepFor(settings: Map<string, Row>, companyId: string | null): number {
  return (companyId ? settings.get(companyId)?.keep_last_per_rep : undefined) ?? DEFAULT_KEEP_PER_REP;
}

/**
 * Every company's current setting, for the purge cron (service role).
 *
 * FAILS CLOSED. The cron DELETES audio with the answer: reading "no setting" when a company had set 200 would purge
 * 180 recordings per rep it chose to keep. So the default applies only when the table itself does not exist yet
 * (0284 not applied — then no company can have a setting, which is exactly D14's stand-in). Any other read failure
 * is returned as an error and the purge must not run.
 */
export async function loadRetention(
  admin: SupabaseClient,
): Promise<{ ok: true; settings: Map<string, Row>; tableMissing: boolean } | { ok: false; error: string }> {
  const { data, error } = await fetchAllPagedResult<Row>(
    (from, to) =>
      admin.from("company_recording_settings").select("id, company_id, keep_last_per_rep").order("id", { ascending: true }).range(from, to),
    { label: "retention settings" },
  );
  if (error) {
    const code = String((error as { code?: unknown }).code ?? "");
    // ONLY a missing TABLE means "no company can have a setting" (D14's 20). A missing COLUMN or anything else is an
    // error: falling back to 20 then could delete audio a company chose to keep (review #5).
    if (TABLE_MISSING.has(code) || /Could not find the table '[^']*company_recording_settings'|relation "[^"]*company_recording_settings" does not exist/i.test(error.message)) {
      return { ok: true, settings: new Map(), tableMissing: true };
    }
    return { ok: false, error: error.message };
  }
  const rows = data ?? [];
  return { ok: true, settings: latestPerCompany(rows), tableMissing: false };
}
