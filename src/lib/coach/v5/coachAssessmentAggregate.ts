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

/** A rep's door-pitch analysis row (pitch_analyses). strengths/improvements are PLAIN STRINGS (unlike the dissect's
 *  {point}/{opportunity} objects). Feeds the SAME Doing Well / Coaching Focus columns (founder 2026-08-27 — "feed
 *  door pitches into the assessment"). */
export type PitchAnalysisRow = { strengths: unknown; improvements: unknown; created_at: unknown };

/**
 * Merge a rep's coaching signal from BOTH sources — coaching-session dissects AND door-pitch analyses — into one
 * newest-first view for Doing Well (strengths) / Coaching Focus (growth). A rep who pitches all day builds real
 * coaching content from their pitches, not only from rare coaching sessions. Dissect strengths are `{point}` and
 * growth is `{opportunity}`; pitch strengths/improvements are plain strings — both normalized to strings here, then
 * ordered newest-first so recent content (a session OR a pitch) surfaces. The caller de-dups + caps (uniqTrim).
 */
export function aggregateCoachingContent(
  dissectRows: DissectEventRow[],
  pitchRows: PitchAnalysisRow[],
): DissectContent {
  type Item = { at: string; strengths: string[]; growth: string[]; strategies: string[] };
  const items: Item[] = [];
  for (const e of dissectRows ?? []) {
    const p = (e?.payload ?? {}) as Record<string, unknown>;
    const at = typeof e?.created_at === "string" ? e.created_at : "";
    const strengths = (Array.isArray(p.strengths) ? p.strengths : [])
      .map((s) => (s as Record<string, unknown>)?.point)
      .filter((x): x is string => typeof x === "string");
    const growth = (Array.isArray(p.growth_areas) ? p.growth_areas : [])
      .map((g) => (g as Record<string, unknown>)?.opportunity)
      .filter((x): x is string => typeof x === "string");
    const strat = p.standout_strategy as Record<string, unknown> | null;
    const strategies = strat && typeof strat.name === "string" ? [strat.name] : [];
    items.push({ at, strengths, growth, strategies });
  }
  for (const r of pitchRows ?? []) {
    const at = typeof r?.created_at === "string" ? r.created_at : "";
    const strengths = (Array.isArray(r?.strengths) ? r.strengths : []).filter(
      (x): x is string => typeof x === "string" && x.trim() !== "",
    );
    const growth = (Array.isArray(r?.improvements) ? r.improvements : []).filter(
      (x): x is string => typeof x === "string" && x.trim() !== "",
    );
    items.push({ at, strengths, growth, strategies: [] });
  }
  items.sort((a, b) => b.at.localeCompare(a.at)); // newest first — recent content leads
  const out: DissectContent = { strengths: [], growth: [], strategies: [], lastAt: null };
  for (const it of items) {
    if (!out.lastAt && it.at) out.lastAt = it.at;
    out.strengths.push(...it.strengths);
    out.growth.push(...it.growth);
    out.strategies.push(...it.strategies);
  }
  return out;
}

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
