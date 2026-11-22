import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";

/**
 * Recording retention per company (RSS Phase 8, migration 0284; Gong F33.1; decision D14).
 *
 * D14 DECIDED 2026-11-23 (founder, picker): the default is 90 DAYS — with no setting, audio older than 90 days is
 * removed, however many calls a rep has. Before, the stand-in was each rep's last 20 (founder 2026-08-26). A company
 * that sets "keep the last N per rep" in Settings → Protection keeps that rule instead. Measured on production before
 * the switch: 18 recordings with audio, 0 company settings; the first 90-day run removes 1 recording the last-20 rule
 * kept, and keeps none it would have removed.
 *
 * This file is the ONE place the rule lives — the purge cron and the settings route both read it from here, so what
 * the screen promises and what the cron deletes cannot drift. A setting is a row; the latest row per company is
 * current (§3.1: a change never overwrites).
 */
export const DEFAULT_RETENTION_DAYS = 90;
/** The number a company's "keep the last N" box starts at when it has no setting. Not a rule by itself any more. */
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

export type RetentionRule = { kind: "count"; keepPerRep: number } | { kind: "days"; days: number };

/** The rule for one company: its own "last N per rep" if it set one, else the 90-day default. Pure. */
export function ruleFor(settings: Map<string, Row>, companyId: string | null): RetentionRule {
  const keep = companyId ? settings.get(companyId)?.keep_last_per_rep : undefined;
  return keep != null ? { kind: "count", keepPerRep: keep } : { kind: "days", days: DEFAULT_RETENTION_DAYS };
}

/**
 * Which recordings are outside their company's window. `rows` MUST be newest-first (the count rule keeps each rep's
 * first N). Pure, so the cron's decision is tested directly; the cron only fetches, removes and reports.
 */
export function outsideRetention<T extends { company_id: string | null; agent_id: string | null; id: string; created_at: string }>(
  rows: readonly T[],
  settings: Map<string, Row>,
  nowMs: number,
): T[] {
  const seenPerRep = new Map<string, number>();
  const out: T[] = [];
  for (const row of rows) {
    const rule = ruleFor(settings, row.company_id);
    if (rule.kind === "days") {
      const t = Date.parse(row.created_at);
      if (Number.isFinite(t) && t < nowMs - rule.days * 86_400_000) out.push(row);
      continue;
    }
    // A null agent_id (shouldn't happen) is its own bucket, never mixed with a real rep's window.
    const key = row.agent_id ?? `__null:${row.id}`;
    const n = (seenPerRep.get(key) ?? 0) + 1;
    seenPerRep.set(key, n);
    if (n > rule.keepPerRep) out.push(row);
  }
  return out;
}

/**
 * Every company's current setting, for the purge cron (service role).
 *
 * FAILS CLOSED. The cron DELETES audio with the answer: reading "no setting" when a company had set 200 would purge
 * 180 recordings per rep it chose to keep. So the default applies only when the table itself does not exist yet
 * (0284 not applied — then no company can have a setting, so every company is on D14's default). Any other read failure
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
    // ONLY a missing TABLE means "no company can have a setting" (D14's default). A missing COLUMN or anything else is an
    // error: falling back to the default then could delete audio a company chose to keep (review #5).
    if (TABLE_MISSING.has(code) || /Could not find the table '[^']*company_recording_settings'|relation "[^"]*company_recording_settings" does not exist/i.test(error.message)) {
      return { ok: true, settings: new Map(), tableMissing: true };
    }
    return { ok: false, error: error.message };
  }
  const rows = data ?? [];
  return { ok: true, settings: latestPerCompany(rows), tableMissing: false };
}
