import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { BONUSES_BY_ID, SECTIONS, VIOLATIONS_BY_ID, type Grade, type SectionId } from "./rubric";
import type { AggregablePitch } from "./aggregate";

/**
 * Load a period of scored pitches in the shape the aggregator wants.
 *
 * The missing link between storage and the Breakdown board: `aggregatePitches` has existed, fully
 * tested, with no caller — the same orphan shape the engine had, and worth naming as such rather
 * than quietly wiring up. A31: schema-complete is not built.
 *
 * READ THROUGH THE CALLER'S CLIENT. `pitches` RLS already says who may see which scores (the rep
 * who gave them, or a manager in the same company), so passing the caller's client makes the
 * policy the access rule rather than whatever the route remembered to check. A Bearer caller
 * without it reads as anonymous and gets a confident, empty, wrong aggregate — which on this
 * surface means a rep is shown a zero average for a week they actually worked.
 *
 * NOTHING IS RECOMPUTED. Section totals come from the stored `section_points` verdict, and the
 * bonus and violation breakdowns are read back from `pitch_events` at the points the scorer
 * AWARDED, not at rubric face value. Re-deriving either is the defect migration 0254 exists to
 * prevent, and doing it here would corrupt every average on the board rather than one pitch.
 */

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v ?? 0) || 0);

/** Pitches whose section verdict predates 0254 and cannot be aggregated honestly. */
export type PeriodRead = {
  pitches: AggregablePitch[];
  /**
   * Scored before `section_points` existed, so their section totals are unknown.
   *
   * Counted and reported rather than silently included with zeros — a pitch contributing 0 to
   * every section would drag the whole board's section averages down and look like a coaching
   * problem. The board says how many were skipped instead.
   */
  skippedPreVerdict: number;
};

export async function readPitchPeriod(
  args: {
    /** One rep's board. Omit for the whole company (a manager's team view). */
    repId?: string;
    /** Inclusive ISO start. Omit for all time. */
    from?: string;
    /** Exclusive ISO end. Omit for no upper bound. */
    to?: string;
    limit?: number;
  },
  client?: SupabaseClient
): Promise<PeriodRead | null> {
  const sb = client ?? (await createServerClient());
  // Bounded well under PostgREST's max_rows of 1,000, so the limit is a real bound and not a
  // number that silently becomes a smaller one.
  const limit = Math.min(args.limit ?? 500, 900);

  // FILTERS BEFORE order/limit, and this is not style. supabase-js returns a
  // PostgrestTransformBuilder from `.order()`/`.limit()`, and that builder has no `.eq()` — so
  // filtering afterwards throws at runtime. It typechecked only because the injected client is
  // an un-generic SupabaseClient, which loosens these calls to `any`. Found by a test that
  // records which filters were actually applied rather than trusting that they were.
  let q = sb
    .from("pitches")
    .select("id, rep_id, recorded_at, base, bonus, violations, total, qualifying, not_qualifying_reason, section_points, outcome");

  if (args.repId) q = q.eq("rep_id", args.repId);
  if (args.from) q = q.gte("recorded_at", args.from);
  if (args.to) q = q.lt("recorded_at", args.to);

  const { data: pitchRows, error } = await q
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Classified, not swallowed. An empty period and a failed read render identically as "0
    // pitches this week", and a rep reading that about a week they worked concludes the product
    // lost their calls.
    // eslint-disable-next-line no-console
    console.error(`[readPitchPeriod] pitch read failed rep=${args.repId ?? "all"}: ${error.message}`);
    return null;
  }

  const rows = pitchRows ?? [];
  if (rows.length === 0) return { pitches: [], skippedPreVerdict: 0 };

  const ids = rows.map((r) => r.id as string);

  const [{ data: elementRows, error: elError }, { data: eventRows, error: evError }] =
    await Promise.all([
      sb.from("pitch_elements").select("pitch_id, element_id, grade").in("pitch_id", ids),
      sb.from("pitch_events").select("pitch_id, type, item_id, points").in("pitch_id", ids),
    ]);

  if (elError || evError) {
    // Also fatal. Continuing without grades produces an aggregate with real section averages and
    // EMPTY per-element rates — a board that looks fully populated while its most actionable half
    // is missing, which is worse than an error because nothing about it looks wrong.
    // eslint-disable-next-line no-console
    console.error(
      `[readPitchPeriod] child read failed rep=${args.repId ?? "all"}: ${(elError ?? evError)!.message}`
    );
    return null;
  }

  const elementsByPitch = new Map<string, { elementId: string; grade: Grade }[]>();
  for (const r of elementRows ?? []) {
    const list = elementsByPitch.get(r.pitch_id as string) ?? [];
    list.push({ elementId: r.element_id as string, grade: r.grade as Grade });
    elementsByPitch.set(r.pitch_id as string, list);
  }

  // Bonus and violation totals per pitch, summed per item — the scorer already applied the
  // ceilings and the cap before these rows were written, so summing them reproduces its verdict
  // rather than re-deriving one.
  const bonusesByPitch = new Map<string, Map<string, number>>();
  const violationsByPitch = new Map<string, Map<string, number>>();
  for (const r of eventRows ?? []) {
    const pitchId = r.pitch_id as string;
    const itemId = r.item_id as string;
    if (r.type === "bonus" && BONUSES_BY_ID.has(itemId)) {
      const m = bonusesByPitch.get(pitchId) ?? new Map();
      m.set(itemId, (m.get(itemId) ?? 0) + num(r.points));
      bonusesByPitch.set(pitchId, m);
    } else if (r.type === "violation" && VIOLATIONS_BY_ID.has(itemId)) {
      const m = violationsByPitch.get(pitchId) ?? new Map();
      m.set(itemId, (m.get(itemId) ?? 0) + num(r.points));
      violationsByPitch.set(pitchId, m);
    }
    // `rejected_bonus` is deliberately ignored: it awarded nothing, so counting it would inflate
    // the board's bonus rates with bonuses the rep never received.
  }

  const pitches: AggregablePitch[] = [];
  let skippedPreVerdict = 0;

  for (const r of rows) {
    const id = r.id as string;
    const stored = (r.section_points ?? null) as Record<string, unknown> | null;

    // A pitch scored before 0254 has no section verdict. Including it with zeros would drag every
    // section average down and read as a coaching problem; guessing from element rows would be
    // wrong on any objection-free pitch. Excluded and counted.
    if (!stored && r.qualifying) {
      skippedPreVerdict += 1;
      continue;
    }

    const sectionPoints = Object.fromEntries(
      SECTIONS.map((s) => [s.id, num(stored?.[s.id])])
    ) as Record<SectionId, number>;

    const outcome = r.outcome as string | null;

    pitches.push({
      score: {
        base: num(r.base),
        bonus: num(r.bonus),
        violations: num(r.violations),
        total: num(r.total),
        qualifying: r.qualifying === true,
        notQualifyingReason: (r.not_qualifying_reason as string | null) ?? null,
        sectionPoints,
        bonusBreakdown: [...(bonusesByPitch.get(id) ?? new Map()).entries()].map(
          ([bonusId, points]) => ({ bonusId, points, capped: false })
        ),
        violationBreakdown: [...(violationsByPitch.get(id) ?? new Map()).entries()].map(
          ([violationId, deduction]) => ({ violationId, deduction, capped: false })
        ),
      },
      elements: elementsByPitch.get(id) ?? [],
      ...(outcome === "sold" || outcome === "follow_up" || outcome === "no_sale"
        ? { outcome }
        : {}),
    });
  }

  return { pitches, skippedPreVerdict };
}
