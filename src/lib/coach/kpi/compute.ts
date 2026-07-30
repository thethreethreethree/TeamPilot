/**
 * KPI compute — pure, testable derivation of Sales-Coach KPIs (SalesCoach-KPI-System.md, Phase 2).
 *
 * Everything here is a PURE function of already-captured rows (no IO), so each metric is unit-testable and
 * every number is traceable to the sessions that produced it. The route/cron layer feeds these rows in and
 * persists the results (kpi_snapshot / agent_baseline).
 *
 * Two disciplines from the spec are enforced HERE, not left to the caller:
 *   1. Understanding Gate — a metric returns value:null ("building") until the sample reaches MIN_SESSIONS.
 *      "Insufficient data" is a valid, visible state; a guessed number never is.
 *   2. Money is exact-decimal — deal values are summed as integer CENTS, never accumulated as floats.
 *
 * Outcome mapping (the real coaching_sessions.outcome values, 0077):
 *   sold → won · no_sale → lost · follow_up/undecided → open · no_contact → not an opportunity (no reach).
 */

export const MIN_SESSIONS = 5;

export type KpiSessionRow = {
  outcome: "sold" | "follow_up" | "no_sale" | "no_contact" | "undecided" | null;
  dealValue: number | null; // dollars (numeric(14,2)); may be null even when sold
  startedAt: string; // ISO
  endedAt: string | null; // ISO
  sessionId: string;
};

/** A single metric result. value:null = gated ("building"); sampleSize = the N it was computed over. */
export type MetricResult = {
  value: number | null;
  sampleSize: number;
  gated: boolean; // true when value is null because sampleSize < the metric's minimum
  sourceSessionIds: string[]; // the sessions that fed this metric (drill-down)
};

function gated(sampleSize: number, sourceSessionIds: string[]): MetricResult {
  return { value: null, sampleSize, gated: true, sourceSessionIds };
}

/** An "opportunity" = a session that reached the customer (excludes no_contact + unrecorded). */
export function isOpportunity(r: KpiSessionRow): boolean {
  return r.outcome !== null && r.outcome !== "no_contact";
}

/** Sum dollar amounts EXACTLY via integer cents (avoids float accumulation error). Returns dollars. */
export function sumDollarsExact(values: number[]): number {
  const cents = values.reduce((acc, v) => acc + Math.round(v * 100), 0);
  return cents / 100;
}

// ---- Layer 1: Sales outcomes -------------------------------------------------------------------------

/** Conversion rate (%) = sold ÷ opportunities. Gate: ≥ MIN_SESSIONS opportunities. */
export function conversionRate(sessions: KpiSessionRow[]): MetricResult {
  const opps = sessions.filter(isOpportunity);
  const ids = opps.map((s) => s.sessionId);
  if (opps.length < MIN_SESSIONS) return gated(opps.length, ids);
  const sold = opps.filter((s) => s.outcome === "sold").length;
  return { value: round1((sold / opps.length) * 100), sampleSize: opps.length, gated: false, sourceSessionIds: ids };
}

/** Close rate (%) = won ÷ resolved (won + lost). Gate: ≥ MIN_SESSIONS resolved. */
export function closeRate(sessions: KpiSessionRow[]): MetricResult {
  const resolved = sessions.filter((s) => s.outcome === "sold" || s.outcome === "no_sale");
  const ids = resolved.map((s) => s.sessionId);
  if (resolved.length < MIN_SESSIONS) return gated(resolved.length, ids);
  const won = resolved.filter((s) => s.outcome === "sold").length;
  return { value: round1((won / resolved.length) * 100), sampleSize: resolved.length, gated: false, sourceSessionIds: ids };
}

/** Total revenue (dollars) from sold sessions with a recorded deal value. Gate: ≥ MIN_SESSIONS sold-with-value. */
export function revenue(sessions: KpiSessionRow[]): MetricResult {
  const sold = sessions.filter((s) => s.outcome === "sold" && s.dealValue !== null);
  const ids = sold.map((s) => s.sessionId);
  if (sold.length < MIN_SESSIONS) return gated(sold.length, ids);
  return { value: sumDollarsExact(sold.map((s) => s.dealValue as number)), sampleSize: sold.length, gated: false, sourceSessionIds: ids };
}

/** Average deal size (dollars) = revenue ÷ count(sold-with-value). Gate: ≥ MIN_SESSIONS sold-with-value. */
export function avgDealSize(sessions: KpiSessionRow[]): MetricResult {
  const sold = sessions.filter((s) => s.outcome === "sold" && s.dealValue !== null);
  const ids = sold.map((s) => s.sessionId);
  if (sold.length < MIN_SESSIONS) return gated(sold.length, ids);
  const total = sumDollarsExact(sold.map((s) => s.dealValue as number));
  return { value: round2(total / sold.length), sampleSize: sold.length, gated: false, sourceSessionIds: ids };
}

// ---- Layer 2: Activity -------------------------------------------------------------------------------

/** Sessions per day = count(sessions) ÷ distinct active days. Gate: ≥ MIN_SESSIONS sessions. */
export function sessionsPerDay(sessions: KpiSessionRow[]): MetricResult {
  const ids = sessions.map((s) => s.sessionId);
  if (sessions.length < MIN_SESSIONS) return gated(sessions.length, ids);
  const days = new Set(sessions.map((s) => s.startedAt.slice(0, 10)));
  const d = days.size || 1;
  return { value: round2(sessions.length / d), sampleSize: sessions.length, gated: false, sourceSessionIds: ids };
}

/** Average session duration (minutes) over ended sessions. Gate: ≥ MIN_SESSIONS ended sessions. */
export function avgSessionDurationMin(sessions: KpiSessionRow[]): MetricResult {
  const ended = sessions.filter((s) => s.endedAt !== null);
  const ids = ended.map((s) => s.sessionId);
  if (ended.length < MIN_SESSIONS) return gated(ended.length, ids);
  const totalMs = ended.reduce((acc, s) => acc + (Date.parse(s.endedAt as string) - Date.parse(s.startedAt)), 0);
  return { value: round1(totalMs / ended.length / 60000), sampleSize: ended.length, gated: false, sourceSessionIds: ids };
}

// ---- Layer 3: Conversation quality (from the existing after-pitch evidenced scores) ------------------

/** One session's after-pitch scores. `caveat` marks a data-capture gap — excluded from the metric. */
export type Layer3ScoreInput = {
  sessionId: string;
  scores: { key: string; score: number; caveat?: boolean }[];
};

/**
 * Average an after-pitch score DIMENSION across the agent's sessions, scaled 0–10 → 0–100 (spec Layer 3).
 * Skips caveat scores (a 100/0 talk-ratio from an untranscribed customer side is a gap, not a behaviour).
 * Gate: ≥ MIN_SESSIONS sessions that actually scored this dimension.
 */
export function layer3Dimension(rows: Layer3ScoreInput[], key: string): MetricResult {
  const vals: number[] = [];
  const ids: string[] = [];
  for (const r of rows) {
    const c = r.scores.find((s) => s.key === key && !s.caveat);
    if (c && Number.isFinite(c.score)) {
      vals.push(c.score);
      ids.push(r.sessionId);
    }
  }
  if (vals.length < MIN_SESSIONS) return gated(vals.length, ids);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { value: round1(avg * 10), sampleSize: vals.length, gated: false, sourceSessionIds: ids };
}

// ---- Layer 4: Coaching & growth (THE DIFFERENTIATOR) -------------------------------------------------

/** Cue acceptance rate (%) = cues acted on ÷ cues delivered. Gate: ≥ MIN_SESSIONS cues delivered. */
export function cueAcceptanceRate(cues: { acted: boolean }[]): MetricResult {
  if (cues.length < MIN_SESSIONS) return gated(cues.length, []);
  const acted = cues.filter((c) => c.acted).length;
  return { value: round1((acted / cues.length) * 100), sampleSize: cues.length, gated: false, sourceSessionIds: [] };
}

/**
 * Reliance reduction (the headline) — the slope of cues-per-session over the agent's session timeline.
 * A NEGATIVE slope = fewer cues needed over time = the agent is internalizing the skill (good). Value is
 * cues/session change per session. Gate: ≥ MIN_SESSIONS sessions. (The "while performance holds" qualifier
 * is applied by the reader against the Layer-3 trend; this returns the raw reliance signal, honestly.)
 */
export function relianceReductionSlope(
  points: { order: number; cueCount: number; sessionId: string }[]
): MetricResult {
  const ids = points.map((p) => p.sessionId);
  const n = points.length;
  if (n < MIN_SESSIONS) return gated(n, ids);
  const xbar = points.reduce((a, p) => a + p.order, 0) / n;
  const ybar = points.reduce((a, p) => a + p.cueCount, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.order - xbar) * (p.cueCount - ybar);
    den += (p.order - xbar) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { value: round2(slope), sampleSize: n, gated: false, sourceSessionIds: ids };
}

// ---- Baseline / delta (self-comparison) --------------------------------------------------------------

/** Rolling mean + stddev of a metric's historical values (population). Feeds delta_vs_baseline. */
export function baseline(historicalValues: number[]): { mean: number | null; stddev: number | null; sampleSize: number } {
  const n = historicalValues.length;
  if (n === 0) return { mean: null, stddev: null, sampleSize: 0 };
  const mean = historicalValues.reduce((a, b) => a + b, 0) / n;
  const variance = historicalValues.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return { mean: round2(mean), stddev: round2(Math.sqrt(variance)), sampleSize: n };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
