/**
 * Pure aggregation core for the manager coach-assessment route
 * (`/api/coach/sales-session/coach-assessment`). Extracted so the payload-shape
 * handling is unit-testable without a live DB (the route itself does the per-rep
 * count + content fetch; this turns the fetched content rows into the coaching
 * signal). Kept pure + defensive: dissect payloads are stored events, so a shape
 * drift must degrade to "nothing extracted", never throw.
 *
 * `lastAt` is the first row's `created_at`: callers pass rows ordered newest-first
 * (`created_at desc`), so the first row is the most recent dissect.
 */
export type DissectEventRow = { payload: unknown; created_at: unknown };

export type DissectContent = {
  strengths: string[];
  growth: string[];
  strategies: string[];
  lastAt: string | null;
};

export function aggregateDissectContent(rows: DissectEventRow[]): DissectContent {
  const out: DissectContent = {
    strengths: [],
    growth: [],
    strategies: [],
    lastAt: null,
  };
  for (const e of rows ?? []) {
    const p = (e?.payload ?? {}) as Record<string, unknown>;
    // Rows arrive newest-first → the first row with a real timestamp is "last active".
    if (!out.lastAt && typeof e?.created_at === "string") out.lastAt = e.created_at;
    const strengths = Array.isArray(p.strengths) ? p.strengths : [];
    for (const s of strengths) {
      const pt = (s as Record<string, unknown>)?.point;
      if (typeof pt === "string") out.strengths.push(pt);
    }
    const growth = Array.isArray(p.growth_areas) ? p.growth_areas : [];
    for (const g of growth) {
      const op = (g as Record<string, unknown>)?.opportunity;
      if (typeof op === "string") out.growth.push(op);
    }
    const strat = p.standout_strategy as Record<string, unknown> | null;
    if (strat && typeof strat.name === "string") out.strategies.push(strat.name);
  }
  return out;
}
