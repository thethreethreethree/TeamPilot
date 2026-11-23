/**
 * Market (2026-11-23; ledger F14.6 "Market page", graded LACK: "Competitors and topics are extracted per call and stored
 * as events, but nothing adds them up into market or competitor trends or ties them to outcomes"). Adds up each call's
 * intel (coach.session_intel_generated: competitors named — grounded in the transcript — and topics discussed) across
 * the calls in view: how often each competitor comes up, week by week, and the win rate when it does against the win
 * rate overall; and the topics most discussed. Pure, so the arithmetic is tested.
 *
 * Win rate = sold ÷ (sold + no sale); other outcomes are not closed. It is null below MIN_CLOSED closed calls — a rate
 * from two calls would be a claim the data can't support (§3.4).
 */
export const MIN_CLOSED = 5;

export type MarketCall = { sessionId: string; startedAt: string; outcome: string | null };
export type Intel = { competitors: string[]; topics: string[] };

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const closed = (o: string | null) => o === "sold" || o === "no_sale";
const winRate = (calls: MarketCall[]) => {
  const c = calls.filter((x) => closed(x.outcome));
  return c.length >= MIN_CLOSED ? c.filter((x) => x.outcome === "sold").length / c.length : null;
};
function weekOf(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow)).toISOString().slice(0, 10);
}

function group(calls: MarketCall[], intel: Map<string, Intel>, pick: (i: Intel) => string[]) {
  const g = new Map<string, { names: Map<string, number>; calls: MarketCall[] }>();
  for (const c of calls) {
    const i = intel.get(c.sessionId);
    if (!i) continue;
    const seen = new Set<string>();
    for (const raw of pick(i)) {
      const k = norm(raw);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const e = g.get(k) ?? { names: new Map<string, number>(), calls: [] as MarketCall[] };
      e.names.set(raw.trim(), (e.names.get(raw.trim()) ?? 0) + 1);
      e.calls.push(c);
      g.set(k, e);
    }
  }
  return [...g.values()].map((e) => ({
    name: [...e.names.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0],
    calls: e.calls,
  }));
}

export function computeMarket(calls: MarketCall[], intel: Map<string, Intel>, topN = 15) {
  const withIntel = calls.filter((c) => intel.has(c.sessionId));
  const competitors = group(withIntel, intel, (i) => i.competitors)
    .map((x) => {
      const weeks = new Map<string, number>();
      for (const c of x.calls) weeks.set(weekOf(c.startedAt), (weeks.get(weekOf(c.startedAt)) ?? 0) + 1);
      return {
        name: x.name,
        calls: x.calls.length,
        share: withIntel.length ? x.calls.length / withIntel.length : 0,
        closed: x.calls.filter((c) => closed(c.outcome)).length,
        winRate: winRate(x.calls),
        weeks: [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([weekStart, n]) => ({ weekStart, calls: n })),
      };
    })
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    .slice(0, topN);
  const topics = group(withIntel, intel, (i) => i.topics)
    .map((x) => ({ name: x.name, calls: x.calls.length }))
    .sort((a, b) => b.calls - a.calls || a.name.localeCompare(b.name))
    .slice(0, topN);
  return {
    calls: calls.length,
    withIntel: withIntel.length,
    closed: withIntel.filter((c) => closed(c.outcome)).length,
    winRate: winRate(withIntel),
    competitors,
    topics,
  };
}
