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

/**
 * Win/loss ratio (Layer 1) — deals won ÷ deals lost, over opportunities (won='sold', lost='no_sale'). A ratio
 * of 2 means two wins per loss. Gated below MIN_SESSIONS opportunities AND when there are zero losses (the
 * ratio is genuinely undefined then — "building", never a fabricated ∞ or a silently-dropped denominator).
 */
export function winLossRatio(sessions: KpiSessionRow[]): MetricResult {
  const opps = sessions.filter(isOpportunity);
  const ids = opps.map((s) => s.sessionId);
  if (opps.length < MIN_SESSIONS) return gated(opps.length, ids);
  const won = opps.filter((s) => s.outcome === "sold").length;
  const lost = opps.filter((s) => s.outcome === "no_sale").length;
  if (lost === 0) return gated(opps.length, ids); // undefined ratio — honest "building", not divide-by-zero
  return { value: round1(won / lost), sampleSize: opps.length, gated: false, sourceSessionIds: ids };
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

/**
 * Quota attainment (%) = deals won this month ÷ the company's monthly deals-won target × 100 (founder-chosen
 * definition, 2026-07-30). Gated (value:null) until a manager SETS a target — never a fabricated number. A
 * rep with 0 wins against a real target is an honest 0%, not "building".
 */
export function quotaAttainment(dealsWonThisMonth: number, monthlyTarget: number | null): MetricResult {
  if (monthlyTarget === null || monthlyTarget <= 0) {
    return { value: null, sampleSize: dealsWonThisMonth, gated: true, sourceSessionIds: [] };
  }
  return {
    value: round1((dealsWonThisMonth / monthlyTarget) * 100),
    sampleSize: dealsWonThisMonth,
    gated: false,
    sourceSessionIds: [],
  };
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

/**
 * Skill progression (Layer 4) — Δ in overall conversation quality vs. the agent's OWN earlier calls. Per
 * after-pitch session, average its non-caveat scores (0-10) into an overall quality; split the time-ordered
 * scored sessions in half; return (recent mean − prior mean) scaled to 0-100 (can be negative). The VALUE is
 * itself the delta — a positive number means the rep is scoring better than they used to. Gate: ≥ 2·MIN_SESSIONS
 * scored sessions.
 */
export function overallSkillProgression(orderedRows: Layer3ScoreInput[]): MetricResult {
  const perSession: { v: number; sid: string }[] = [];
  for (const r of orderedRows) {
    const vals = r.scores.filter((s) => !s.caveat && Number.isFinite(s.score)).map((s) => s.score);
    if (vals.length > 0) perSession.push({ v: vals.reduce((a, b) => a + b, 0) / vals.length, sid: r.sessionId });
  }
  const ids = perSession.map((p) => p.sid);
  if (perSession.length < 2 * MIN_SESSIONS) return gated(perSession.length, ids);
  const mid = Math.floor(perSession.length / 2);
  const mean = (a: { v: number }[]) => a.reduce((x, y) => x + y.v, 0) / a.length;
  const delta = (mean(perSession.slice(mid)) - mean(perSession.slice(0, mid))) * 10;
  return { value: round1(delta), sampleSize: perSession.length, gated: false, sourceSessionIds: ids };
}

/**
 * Consistency (Layer 4) — how steady the agent's conversation quality is call-to-call (spec: inverse of
 * performance variance). 0-100 where higher = steadier. From the per-session overall-quality series (0-10),
 * consistency = 100 − stddev·20 (stddev 0 → 100 perfectly steady; stddev 5, the max spread of a 0-10 metric,
 * → 0), floored at 0. Gate: ≥ MIN_SESSIONS scored sessions.
 */
export function qualityConsistency(rows: Layer3ScoreInput[]): MetricResult {
  const perSession: number[] = [];
  const ids: string[] = [];
  for (const r of rows) {
    const vals = r.scores.filter((s) => !s.caveat && Number.isFinite(s.score)).map((s) => s.score);
    if (vals.length > 0) {
      perSession.push(vals.reduce((a, b) => a + b, 0) / vals.length);
      ids.push(r.sessionId);
    }
  }
  if (perSession.length < MIN_SESSIONS) return gated(perSession.length, ids);
  const sd = baseline(perSession).stddev ?? 0;
  return { value: round1(Math.max(0, 100 - sd * 20)), sampleSize: perSession.length, gated: false, sourceSessionIds: ids };
}

/**
 * Self-comparison delta for a Layer-3 dimension (recent-half − prior-half of that dimension's per-session
 * scores, scaled 0-100). Extends "each metric shown against its own trajectory" to the quality scores.
 * null unless ≥ 2·MIN_SESSIONS sessions scored the dimension.
 */
export function layer3Delta(rows: Layer3ScoreInput[], key: string): number | null {
  const series: number[] = [];
  for (const r of rows) {
    const c = r.scores.find((s) => s.key === key && !s.caveat);
    if (c && Number.isFinite(c.score)) series.push(c.score);
  }
  if (series.length < 2 * MIN_SESSIONS) return null;
  const mid = Math.floor(series.length / 2);
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return round1((mean(series.slice(mid)) - mean(series.slice(0, mid))) * 10);
}

// ---- Layer 4: Coaching & growth (THE DIFFERENTIATOR) -------------------------------------------------

/** Cue acceptance rate (%) = cues acted on ÷ cues delivered. Gate: ≥ MIN_SESSIONS cues delivered. */
export function cueAcceptanceRate(cues: { acted: boolean }[]): MetricResult {
  if (cues.length < MIN_SESSIONS) return gated(cues.length, []);
  const acted = cues.filter((c) => c.acted).length;
  return { value: round1((acted / cues.length) * 100), sampleSize: cues.length, gated: false, sourceSessionIds: [] };
}

/**
 * Cue-to-outcome correlation (Layer 4, the spec's #2 principle — consequence, not agreement). Point-biserial
 * (Pearson) correlation across sessions between the session's acted-cue rate (0-1) and whether it was WON.
 * Positive = acting on cues associates with selling. It is an ASSOCIATION, not proof of causation — the UI
 * must say so. Correlations are noisy on little data, so the gate is higher: ≥ 2·MIN_SESSIONS sessions that
 * had BOTH ≥1 cue and a recorded win/loss outcome. Range −1..1.
 */
export function cueToOutcomeCorrelation(
  sessions: { actedRate: number; won: boolean; sessionId: string }[]
): MetricResult {
  const ids = sessions.map((s) => s.sessionId);
  if (sessions.length < 2 * MIN_SESSIONS) return gated(sessions.length, ids);
  const n = sessions.length;
  const mx = sessions.reduce((a, s) => a + s.actedRate, 0) / n;
  const my = sessions.reduce((a, s) => a + (s.won ? 1 : 0), 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const s of sessions) {
    const a = s.actedRate - mx;
    const b = (s.won ? 1 : 0) - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return { value: denom === 0 ? 0 : round2(num / denom), sampleSize: n, gated: false, sourceSessionIds: ids };
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

/**
 * Reliance reduction measured from the agent's FIRST CUED session onward (residual-#1 fix). Sessions before
 * the first cue are the observe window (the coach listens but doesn't cue) or pre-coach — a 0-cue count there
 * is not a reliance signal and would flatten/mislead the slope. We drop that leading run and re-index, so the
 * slope reflects the trend once cueing actually began. Gate: ≥ MIN_SESSIONS cued-era sessions.
 * (A residual remains: a post-first-cue session where the rep simply didn't use the coach also reads 0 cues;
 * distinguishing that needs a per-session coach-active flag — tracked in the KPI residuals audit.)
 */
export function relianceReductionFromFirstCue(
  points: { cueCount: number; sessionId: string }[]
): MetricResult {
  const firstIdx = points.findIndex((p) => p.cueCount > 0);
  if (firstIdx === -1) return gated(0, []);
  const relevant = points
    .slice(firstIdx)
    .map((p, i) => ({ order: i + 1, cueCount: p.cueCount, sessionId: p.sessionId }));
  return relianceReductionSlope(relevant);
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

/**
 * Self-comparison delta (spec principle #1: measure against the agent's OWN past). Splits the agent's
 * time-ordered sessions in half and returns recent-half − prior-half for a session-based metric — "are you
 * better than when you started?" On-read, no baselines table needed. null unless BOTH halves clear the gate
 * (so ≥ 2·MIN_SESSIONS sessions and both halves compute a value). Direction (good/bad) is the caller's to
 * interpret per metric.
 */
export function selfDelta(
  orderedSessions: KpiSessionRow[],
  metricFn: (s: KpiSessionRow[]) => MetricResult
): number | null {
  if (orderedSessions.length < 2 * MIN_SESSIONS) return null;
  const mid = Math.floor(orderedSessions.length / 2);
  const prior = metricFn(orderedSessions.slice(0, mid));
  const recent = metricFn(orderedSessions.slice(mid));
  if (prior.value === null || recent.value === null) return null;
  return round1(recent.value - prior.value);
}

/** Founder-set exception-alert threshold: flag a rep who has slipped ≥ this fraction below their own baseline. */
export const ALERT_DROP_FRACTION = 0.15;

/**
 * Exception alert (founder 2026-07-30): is the rep's recent half ≥ ALERT_DROP_FRACTION below their prior half
 * on this metric? Same recent-vs-prior split as selfDelta, but a relative-drop test for a manager flag. Only
 * fires with enough data on both halves and a positive prior (so it's a real decline, not a zero-baseline).
 */
export function isSlippingVsBaseline(
  orderedSessions: KpiSessionRow[],
  metricFn: (s: KpiSessionRow[]) => MetricResult,
  dropFraction: number = ALERT_DROP_FRACTION
): boolean {
  if (orderedSessions.length < 2 * MIN_SESSIONS) return false;
  const mid = Math.floor(orderedSessions.length / 2);
  const prior = metricFn(orderedSessions.slice(0, mid)).value;
  const recent = metricFn(orderedSessions.slice(mid)).value;
  if (prior === null || recent === null || prior <= 0) return false;
  return recent < prior * (1 - dropFraction);
}

/**
 * A session's OVERALL quality = the mean of its non-caveat evidenced after-pitch scores (0-10). Mirrors
 * layer3Dimension's caveat-skip (a caveated score is "not enough evidence", so it must not drag the mean).
 * Null when the session has no usable score — the caller treats null as "no reading", never as zero.
 */
export function overallQualityForSession(input: Layer3ScoreInput): number | null {
  const usable = input.scores.filter((s) => !s.caveat && Number.isFinite(s.score));
  if (usable.length === 0) return null;
  return usable.reduce((sum, s) => sum + s.score, 0) / usable.length;
}

/**
 * Series form of the exception alert: is the recent half of an ordered numeric series ≥dropFraction below the
 * prior half's mean? Used for the quality-slippage trigger (per-session overall quality in time order), where
 * the metric is a value-per-session, not a rate over a session set. Nulls (unscored sessions) are dropped
 * first; then the same ≥2·MIN_SESSIONS + positive-prior gates as isSlippingVsBaseline apply — so a thin or
 * all-zero history never trips a false alert.
 */
export function isSlippingSeries(
  orderedValues: Array<number | null>,
  dropFraction: number = ALERT_DROP_FRACTION
): boolean {
  const vals = orderedValues.filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length < 2 * MIN_SESSIONS) return false;
  const mid = Math.floor(vals.length / 2);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const prior = mean(vals.slice(0, mid));
  const recent = mean(vals.slice(mid));
  if (prior <= 0) return false;
  return recent < prior * (1 - dropFraction);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
