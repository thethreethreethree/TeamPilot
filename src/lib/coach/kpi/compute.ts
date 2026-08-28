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

import { conversationDurationSeconds } from "@/lib/coach/conversationDuration";

export const MIN_SESSIONS = 5;

export type KpiSessionRow = {
  outcome: "sold" | "follow_up" | "no_sale" | "no_contact" | "undecided" | null;
  dealValue: number | null; // dollars (numeric(14,2)); may be null even when sold
  startedAt: string; // ISO
  endedAt: string | null; // ISO
  // Real audio length (whole seconds) of an UPLOADED recording (0210); null for live sessions. The
  // duration metric prefers this so an upload's length isn't the session wall-clock (§3.5).
  audioDurationSeconds: number | null;
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
  // Prefer the recording's REAL audio length for uploads over the session wall-clock (which is just how long
  // an uploaded session sat open — it showed 62m for a 4m clip). Live sessions have no audio length and use
  // the wall-clock, which is correct there. §3.5: a meeting-duration metric that doesn't match the audio is a
  // dishonest metric, exactly what the constitution forbids.
  // Sum the shared per-session length (audit F8): the prefer-audio + wall-clock + finite-guard rule now lives
  // in ONE tested helper, conversationDurationSeconds — the After-Pitch header + Sessions list read the same
  // rule, so they can't drift (the vein that let the "62m for a 4m clip" bug span three surfaces).
  const totalSec = ended.reduce(
    (acc, s) =>
      acc + (conversationDurationSeconds(s.audioDurationSeconds, s.startedAt, s.endedAt) ?? 0),
    0,
  );
  return { value: round1(totalSec / ended.length / 60), sampleSize: ended.length, gated: false, sourceSessionIds: ids };
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
 * UTC month key ("YYYY-MM") for a date. ONE definition shared by /me, /team, and the cron so "this month" is
 * computed identically everywhere — quota attainment must match between a rep's own view and the manager
 * rollup, and the cron's monthly snapshot must use the same bucket. Pure (takes the Date) so it's testable and
 * can't silently drift to local time on one surface. An ISO timestamp's leading 7 chars equal this key, which
 * is why `startedAt.slice(0, 7) === monthKeyUtc(now)` correctly buckets a session into the current month.
 */
export function monthKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

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
 * Parse a raw after_pitch_summaries `payload` into a Layer3ScoreInput. Pure + defensive: tolerates a missing
 * or non-array `scores`, and keeps only entries with a string key + numeric score (a caveat flag defaults
 * false). ONE parser shared by /me and /team so the two can't drift on how a score is validated or how a
 * caveat is read — the risk that motivated extracting it.
 */
export function layer3InputFromPayload(sessionId: string, payload: unknown): Layer3ScoreInput {
  const p = (payload ?? {}) as { scores?: unknown };
  const scoresRaw = Array.isArray(p.scores) ? p.scores : [];
  return {
    sessionId,
    scores: scoresRaw
      .map((s) => s as { key?: unknown; score?: unknown; caveat?: unknown })
      .filter((s) => typeof s.key === "string" && typeof s.score === "number")
      .map((s) => ({ key: s.key as string, score: s.score as number, caveat: !!s.caveat })),
  };
}

/**
 * Collapse append-only after_pitch_summaries to ONE row per session — the LATEST by created_at, which the table's
 * own design calls "the current summary" (migration 0080). The KPI reads MUST dedup this way: a session whose
 * after-pitch was re-generated (viewed more than once, or backfilled) has MULTIPLE rows, and counting them all
 * double-counts that session in every payload-derived metric (inflating Layer-3 sample sizes, re-scoring the same
 * call). Pure; on equal created_at the later-seen row wins (stable, deterministic). Rows must carry `created_at`
 * for this to pick the true latest — without it every row ties and the last-seen wins (still one per session).
 */
export function latestSummaryPerSession<T extends { session_id: unknown; created_at?: unknown }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const r of rows) {
    const sid = String(r.session_id);
    const prev = latest.get(sid);
    if (!prev || String(r.created_at ?? "") >= String(prev.created_at ?? "")) latest.set(sid, r);
  }
  return [...latest.values()];
}

/**
 * Objections tallied in one analyzed session — the WHOLE-CALL count the after-pitch LLM pass emits (payload
 * `objections`), NOT the 3-5 hero moments (those undercount — an objection only becomes a moment when it defined
 * the call). `raised` = distinct customer objections; `resolved` = how many the rep moved the customer past.
 */
export type ObjectionInput = {
  sessionId: string;
  raised: number;
  resolved: number;
};

/**
 * Parse a raw after_pitch_summaries `payload` into an ObjectionInput, or NULL when the payload has no objection
 * tally (a summary generated before the tally existed). Returning null — not a 0/0 — is the honesty guard: an
 * un-tallied session is EXCLUDED from the KPI ("building"), never counted as a fabricated "no objections". Pure +
 * defensive: clamps to non-negative integers and resolved ≤ raised.
 */
export function objectionInputFromPayload(sessionId: string, payload: unknown): ObjectionInput | null {
  const p = (payload ?? {}) as { objections?: unknown };
  const o = p.objections;
  if (!o || typeof o !== "object") return null;
  const t = o as { raised?: unknown; resolved?: unknown };
  if (typeof t.raised !== "number" || !Number.isFinite(t.raised)) return null;
  const raised = Math.max(0, Math.round(t.raised));
  const resolvedRaw = typeof t.resolved === "number" && Number.isFinite(t.resolved) ? t.resolved : 0;
  const resolved = Math.min(raised, Math.max(0, Math.round(resolvedRaw)));
  return { sessionId, raised, resolved };
}

/**
 * Objections per session (Layer 2) — the average number of objections a rep MEETS per analyzed call. A leading
 * behavioural indicator: how much resistance the rep is drawing out (too few can mean they never surfaced the
 * real hesitation; a healthy number met and resolved is the goal). A session with zero objections is a valid
 * data point (counts toward the average). Gate: ≥ MIN_SESSIONS analyzed (tallied) sessions.
 */
export function objectionsPerSession(rows: ObjectionInput[]): MetricResult {
  const ids = rows.map((r) => r.sessionId);
  if (rows.length < MIN_SESSIONS) return gated(rows.length, ids);
  const totalRaised = rows.reduce((a, r) => a + r.raised, 0);
  return { value: round1(totalRaised / rows.length), sampleSize: rows.length, gated: false, sourceSessionIds: ids };
}

/**
 * Objection resolution rate (%) — of every objection raised across the rep's analyzed calls, the share they met
 * without a breakdown (the "and how many you resolve" half). Gate: ≥ MIN_SESSIONS analyzed sessions AND ≥1
 * objection actually raised — a rate over zero objections is UNDEFINED, so it returns "building" rather than a
 * fabricated 100% (§3.4: an honest insufficient-data, never a guessed number).
 */
export function objectionResolutionRate(rows: ObjectionInput[]): MetricResult {
  const ids = rows.map((r) => r.sessionId);
  if (rows.length < MIN_SESSIONS) return gated(rows.length, ids);
  const totalRaised = rows.reduce((a, r) => a + r.raised, 0);
  if (totalRaised === 0) return gated(rows.length, ids); // no objections yet — undefined rate, not a false 100%
  const totalResolved = rows.reduce((a, r) => a + r.resolved, 0);
  return { value: round1((totalResolved / totalRaised) * 100), sampleSize: rows.length, gated: false, sourceSessionIds: ids };
}

/**
 * Recommendation uptake (Layer 4) input — one analyzed session's coachable focus + its dimension scores.
 * `focusKey` = the flagged growth dimension that became the session's recommendation (null if none flagged with a
 * known improvement direction). `scores` maps each scored dimension key → its 0-10 score, used to check whether
 * the NEXT session moved the focus dimension in the improving direction. `startedAt` orders sessions in time.
 */
export type RecommendationInput = {
  sessionId: string;
  startedAt: string;
  focusKey: string | null;
  scores: Record<string, number>;
};

/**
 * A flagged focus dimension sits at an EXTREME, so "uptake" = the next session moved it toward the healthy middle
 * — and the improving direction is OPPOSITE per dimension. Getting this wrong INVERTS the metric (a rep who talked
 * even MORE would score as "took the advice"). Only dimensions with a known direction are evaluable; any other
 * flagged dimension is skipped rather than guessed. talk_ratio.score = rep's talk share (flagged ≥75 → improve by
 * talking LESS); question_rate.score = questions asked (flagged ≤15 → improve by asking MORE). Kept in sync with
 * salesScore.ts computeTalkRatio / computeQuestionRate.
 */
const FOCUS_IMPROVEMENT_DIR: Record<string, "lower" | "higher"> = {
  talk_ratio: "lower",
  question_rate: "higher",
};

/**
 * Parse an after_pitch_summaries `payload` into a RecommendationInput. Pure + defensive: reads each non-caveat
 * numeric dimension score, and picks the FIRST flagged dimension that has a known improvement direction as the
 * session's focus (mirrors deriveFocus's "a flagged score wins"). A payload with no such flagged dimension yields
 * focusKey=null → the session contributes scores for a NEXT-session comparison but starts no evaluable pair.
 */
export function recommendationInputFromPayload(
  sessionId: string,
  startedAt: string,
  payload: unknown
): RecommendationInput {
  const p = (payload ?? {}) as { scores?: unknown };
  const scoresRaw = Array.isArray(p.scores) ? p.scores : [];
  const scores: Record<string, number> = {};
  let focusKey: string | null = null;
  for (const s of scoresRaw) {
    const c = s as { key?: unknown; score?: unknown; flagged?: unknown; caveat?: unknown };
    if (typeof c.key !== "string" || typeof c.score !== "number" || !Number.isFinite(c.score) || c.caveat) continue;
    scores[c.key] = c.score;
    if (focusKey === null && c.flagged === true && FOCUS_IMPROVEMENT_DIR[c.key]) focusKey = c.key;
  }
  return { sessionId, startedAt, focusKey, scores };
}

/**
 * Recommendation uptake (%) (Layer 4) — of the sessions that surfaced a coachable focus, in how many did the NEXT
 * session actually move that dimension toward the healthy middle? This is the coaching-works differentiator
 * (§4/§3.6), measured by downstream CONSEQUENCE (did the behaviour change next time), never by "the rep agreed"
 * (§3.5 — measuring agreement is grading your own homework). Deterministic from stored scores, no LLM. Dedups the
 * append-only multi-view summary rows, orders sessions by time, and for each session N with a focus dimension D
 * that N+1 also re-scored, counts "taken up" iff N+1 moved D in D's improving direction. Gate: ≥ MIN_SESSIONS
 * evaluable pairs (focus flagged AND re-scored next session) — an honest "building" until the evidence exists.
 */
export function recommendationUptake(rows: RecommendationInput[]): MetricResult {
  const bySession = new Map<string, RecommendationInput>();
  for (const r of rows) bySession.set(r.sessionId, r);
  const ordered = [...bySession.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  let taken = 0;
  const ids: string[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const cur = ordered[i];
    const next = ordered[i + 1];
    if (!cur || !next || !cur.focusKey) continue;
    const dir = FOCUS_IMPROVEMENT_DIR[cur.focusKey];
    if (!dir) continue;
    const before = cur.scores[cur.focusKey];
    const after = next.scores[cur.focusKey];
    if (before === undefined || after === undefined) continue; // next session didn't re-score it → not evaluable
    ids.push(cur.sessionId);
    if (dir === "lower" ? after < before : after > before) taken++;
  }
  if (ids.length < MIN_SESSIONS) return gated(ids.length, ids);
  return { value: round1((taken / ids.length) * 100), sampleSize: ids.length, gated: false, sourceSessionIds: ids };
}

/**
 * One session reduced to its prospect identity + outcome, for the prospect-level metrics (Follow-up rate, Sales
 * cycle). Prospect identity = the normalized client_label the rep already enters (see `prospectKeyOf`). An honest
 * PROXY, not exact: free-text labels can mismatch ("Mr. Smith" ≠ "John Smith") or collide (two "John Smith"s), so
 * these metrics read the rep's own labelling — the surface frames them as such, never as a precise CRM count.
 */
export type ProspectSessionInput = {
  sessionId: string;
  prospectKey: string; // "" when the session has no usable client_label (excluded from the prospect metrics)
  startedAt: string;
  outcome: KpiSessionRow["outcome"];
};

/** Normalize a free-text client_label into a prospect key (trim + lowercase + collapse inner whitespace). "" for
 *  a blank/absent label. ONE normalizer so /me and /team group prospects identically (no cross-view drift). */
export function prospectKeyOf(clientLabel: unknown): string {
  return typeof clientLabel === "string" ? clientLabel.trim().toLowerCase().replace(/\s+/g, " ") : "";
}

/**
 * Follow-up rate (%) (Layer 2) — of the rep's distinct prospects (by normalized client_label), the share they
 * RE-CONTACTED (appeared in >1 session). A leading indicator of persistence / pipeline follow-through. Unlabeled
 * sessions are excluded. Gate: ≥ MIN_SESSIONS distinct labeled prospects — an honest "building" until the rep has
 * enough named prospects to rate.
 */
export function followUpRate(rows: ProspectSessionInput[]): MetricResult {
  const sessionsByProspect = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.prospectKey) continue;
    (sessionsByProspect.get(r.prospectKey) ?? sessionsByProspect.set(r.prospectKey, []).get(r.prospectKey)!).push(r.sessionId);
  }
  const prospects = [...sessionsByProspect.values()];
  const ids = prospects.flat();
  if (prospects.length < MIN_SESSIONS) return gated(prospects.length, ids);
  const recontacted = prospects.filter((s) => s.length > 1).length;
  return { value: round1((recontacted / prospects.length) * 100), sampleSize: prospects.length, gated: false, sourceSessionIds: ids };
}

/**
 * Sales cycle length (days) (Layer 1) — for prospects the rep eventually SOLD, the average time from FIRST contact
 * to the sale (0 for a same-session close). Prospect identity = normalized client_label. Gate: ≥ MIN_SESSIONS sold
 * prospects — an honest "building" until enough closes exist to average a cycle.
 */
export function salesCycleLengthDays(rows: ProspectSessionInput[]): MetricResult {
  const byProspect = new Map<string, { first: string; sold: string | null; ids: string[] }>();
  for (const r of rows) {
    if (!r.prospectKey) continue;
    const e = byProspect.get(r.prospectKey) ?? { first: r.startedAt, sold: null, ids: [] };
    if (r.startedAt < e.first) e.first = r.startedAt;
    if (r.outcome === "sold" && (e.sold === null || r.startedAt < e.sold)) e.sold = r.startedAt;
    e.ids.push(r.sessionId);
    byProspect.set(r.prospectKey, e);
  }
  const cycles: number[] = [];
  const ids: string[] = [];
  for (const [, e] of byProspect) {
    if (e.sold === null) continue;
    const days = (Date.parse(e.sold) - Date.parse(e.first)) / 86_400_000;
    if (Number.isFinite(days) && days >= 0) {
      cycles.push(days);
      ids.push(...e.ids);
    }
  }
  if (cycles.length < MIN_SESSIONS) return gated(cycles.length, ids);
  const avg = cycles.reduce((a, b) => a + b, 0) / cycles.length;
  return { value: round1(avg), sampleSize: cycles.length, gated: false, sourceSessionIds: ids };
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

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
