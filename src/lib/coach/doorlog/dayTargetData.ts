import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateDayTarget, type DayTarget } from "./dayTarget";

/**
 * Door home screen — the read layer that feeds the pure engine (Phase 04). It reads the manager-set goal,
 * computes the rep's 30-day close/contact ratios from the EXISTING door_knocks + pitches (INSPECTION.md Q2 —
 * no new activity table), calls calculateDayTarget, and FREEZES the result for the rep's local day (03/05 —
 * a target that moves during the day rewards stopping, so it is computed once at the first open and stored).
 *
 * Uses the CALLER-SCOPED db (RLS: a rep sees/writes only their own; a same-company manager can read). The
 * ratio window mixes two date sources honestly: doors/sold by door_knocks.local_date (the rep's sales day),
 * presentations by pitches.recorded_at (pitches carry no local_date; each links to a knock, but a 30-day
 * ratio does not need day-exact precision — noted so it is not mistaken for a bug).
 */

export const WINDOW_DAYS = 30;
export const QUALIFY_MIN_PRESENTATIONS = 10; // one sale is not a ratio, and a handful of presentations isn't either
export const QUALIFY_MIN_SALES = 1;

export type DayTargetView = DayTarget & {
  salesGoal: number | null; // null when the manager hasn't set one → the empty state, not a fabricated target
  closeRatio: number | null;
  contactRatio: number | null;
  /** Manager-set dollar value per sale, in CENTS (0248). null → the cash box degrades to "sales to goal"
   *  rather than fabricating $0 (§3.4). Read LIVE (not frozen) — it's a display rate, not a target. */
  saleValueCents: number | null;
  qualified: boolean;
  frozen: boolean; // true when returned from the stored (already-frozen) row
};

const EMPTY_NO_GOAL: DayTargetView = {
  doorsTarget: 0, presentationsTarget: 0, soldTarget: 0, usedStarter: true,
  salesGoal: null, closeRatio: null, contactRatio: null, saleValueCents: null, qualified: false, frozen: false,
};

function windowStart(localDate: string): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (WINDOW_DAYS - 1));
  return d.toISOString().slice(0, 10);
}

/** Read the frozen day target for the rep's local day, or compute + freeze it on first open. */
export async function getOrFreezeDayTarget(args: {
  db: SupabaseClient;
  repId: string;
  companyId: string;
  localDate: string; // 'YYYY-MM-DD', the rep's local sales day (computeLocalSalesDate)
}): Promise<DayTargetView> {
  const { db, repId, companyId, localDate } = args;

  // The manager-set goal row FIRST — it carries both the daily goal and the $-per-sale value the cash box needs.
  // select("*") not a named projection so a pre-0248 DB (sale_value_cents not yet added) doesn't error (A34); the
  // column reads as undefined and the cash box degrades to "sales to goal". Read LIVE on every open (not frozen)
  // because it's a display rate the manager may change intra-day — unlike the targets, which freeze.
  const { data: goalRow } = await db
    .from("rep_daily_sales_goal")
    .select("*")
    .eq("rep_id", repId)
    .maybeSingle();
  const salesGoal = (goalRow?.sales_goal as number | null) ?? null;
  const saleValueCents = (goalRow?.sale_value_cents as number | null | undefined) ?? null;

  // 1. Already frozen for today → return it unchanged (never recompute intra-day), with the LIVE $-per-sale.
  const { data: frozen } = await db
    .from("rep_day_target")
    .select("doors_target, presentations_target, sold_target, used_starter, sales_goal, close_ratio, contact_ratio")
    .eq("rep_id", repId)
    .eq("local_date", localDate)
    .maybeSingle();
  if (frozen) {
    return {
      doorsTarget: frozen.doors_target as number,
      presentationsTarget: frozen.presentations_target as number,
      soldTarget: frozen.sold_target as number,
      usedStarter: Boolean(frozen.used_starter),
      salesGoal: (frozen.sales_goal as number | null) ?? null,
      closeRatio: (frozen.close_ratio as number | null) ?? null,
      contactRatio: (frozen.contact_ratio as number | null) ?? null,
      saleValueCents,
      qualified: !frozen.used_starter,
      frozen: true,
    };
  }

  // 2. No goal → the empty state (don't freeze; the manager may set it later).
  if (salesGoal == null || salesGoal <= 0) return EMPTY_NO_GOAL;

  // 3. 30-day ratios from the existing tables.
  const since = windowStart(localDate);
  const sinceTs = `${since}T00:00:00Z`;
  const [doorsRes, soldRes, presRes] = await Promise.all([
    db.from("door_knocks").select("id", { count: "exact", head: true }).eq("rep_id", repId).gte("local_date", since).lte("local_date", localDate),
    db.from("door_knocks").select("id", { count: "exact", head: true }).eq("rep_id", repId).eq("outcome", "sold").gte("local_date", since).lte("local_date", localDate),
    db.from("pitches").select("id", { count: "exact", head: true }).eq("rep_id", repId).gte("recorded_at", sinceTs),
  ]);
  const doors = doorsRes.count ?? 0;
  const sold = soldRes.count ?? 0;
  const presentations = presRes.count ?? 0;

  const closeRatio = presentations > 0 ? sold / presentations : null;
  const contactRatio = doors > 0 ? presentations / doors : null;
  const qualified = presentations >= QUALIFY_MIN_PRESENTATIONS && sold >= QUALIFY_MIN_SALES;

  const target = calculateDayTarget({ salesGoal, closeRatio, contactRatio, qualified });

  // 4. Freeze it for today. Insert-only + PK(rep_id, local_date): a concurrent second open just no-ops.
  await db
    .from("rep_day_target")
    .insert({
      rep_id: repId,
      local_date: localDate,
      company_id: companyId,
      sales_goal: salesGoal,
      close_ratio: closeRatio,
      contact_ratio: contactRatio,
      doors_target: target.doorsTarget,
      presentations_target: target.presentationsTarget,
      sold_target: target.soldTarget,
      used_starter: target.usedStarter,
    })
    .then(
      () => undefined,
      () => undefined, // best-effort: a duplicate (already frozen by a racing open) is fine; the read path wins next time
    );

  return { ...target, salesGoal, closeRatio, contactRatio, saleValueCents, qualified, frozen: false };
}
