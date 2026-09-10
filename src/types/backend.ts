// backend.ts — TypeScript shapes for the Elostate coaching backend, mirrored from the server data layer
// (src/lib/data/salesCoach.ts and the migrations). Keep these in sync with the server; they are the app's
// contract for the tables it reads directly via Supabase and the JSON the coach routes return.
//
// Columns are grounded in supabase/migrations/0070 (foundation), 0077 (capture: territory/approach/offer/
// outcome), 0205 (deal_value), 0210 (audio_duration_seconds), 0236 (segment source), 0237 (session_kind).

export type SessionContext = "in_person" | "video";
/**
 * `"reviewed"` IS IN THE COLUMN'S TYPE AND NOTHING EVER WRITES IT.
 *
 * Checked against the web repository on 4 September: `sales-session/list`
 * carries a note from 2026-08-14 recording that filtering on `status =
 * 'reviewed'` "returned zero rows for everyone". A reviewed session is an ENDED
 * one that also has a `coach.sales_review_generated` event; the web derives it
 * from those events and never from this column.
 *
 * So do NOT branch on `'reviewed'` here. This app currently does not — verified
 * by sweep, not assumed — and the value is kept in the union only because the
 * column's own CHECK constraint allows it. Anyone who reaches for it will get a
 * screen that is silently always empty, which is how the web lost a day to it.
 */
export type SessionStatus = "active" | "ended" | "reviewed";
export type SessionKind = "sales" | "meeting" | "huddle";
export type SessionOutcome = "sold" | "follow_up" | "no_sale" | "no_contact" | "undecided";
export type Speaker = "agent" | "customer" | "unknown";

/** A row of `coaching_sessions` — owned by agent_id, scoped to company_id. */
export interface CoachingSession {
  id: string;
  company_id: string;
  agent_id: string;
  context: SessionContext;
  client_label: string | null;
  status: SessionStatus;
  session_kind: SessionKind;
  audio_asset_url: string | null;
  audio_duration_seconds: number | null;
  territory: string | null; // WHERE
  approach: string | null; // HOW
  offer: string | null; // WHAT
  outcome: SessionOutcome | null;
  // deal_value is NUMERIC(14,2) on the server (0205) — a DECIMAL currency amount (e.g. 1500.00 = $1,500.00),
  // NOT integer cents. PostgREST may serialize numeric as a string to preserve precision, so coerce defensively
  // (Number(x)) and format as dollars.cents — do NOT divide by 100.
  deal_value: number | string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

/** A row of `coaching_transcript_segments` — APPEND-ONLY. */
export interface TranscriptSegment {
  id: string;
  session_id: string;
  speaker: Speaker;
  text: string;
  seq: number;
  source: string | null; // attribution reason (0236)
  spoken_at: string | null;
  created_at: string;
}

/** A row of `coaching_cues` — APPEND-ONLY (the in-call suggestions the coach delivered). */
export interface CoachingCue {
  id: string;
  session_id: string;
  mode: "suggestion" | "guide_response";
  text: string;
  trigger: string | null;
  latency_ms: number | null;
  delivered_at: string | null;
  created_at: string;
}

/** The coach AI "Suggested Response" / "Prospect Intel" JSON (extension routes). */
export interface SuggestResult {
  reply: string;
  reasoning?: string;
}

/** SSE events streamed by POST /api/coach/extension/suggest with { stream: true }. */
export type SuggestStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; reply: string; reasoning?: string }
  | { type: "error"; error: string; kind?: string };

// ── KPI contract (live: the Bearer shim landed; /api/coach/kpi/me answers the app) ──
// Grounded in src/app/api/coach/kpi/me/route.ts + src/lib/coach/kpi/compute.ts (MetricResult). One metric per key.

/** One KPI metric. `value` is null while `gated` (sampleSize below the metric's minimum → "building"). */
export interface MetricResult {
  value: number | null;
  sampleSize: number;
  gated: boolean; // true → the UI shows "building", never a fabricated number (§3.4)
  sourceSessionIds: string[]; // the sessions that fed this metric (drill-down)
}

/** Response of GET /api/coach/kpi/me?scope=self|company. `metrics` is keyed by metric name. */
export interface KpiResponse {
  sessionCount: number;
  minSessions: number; // the Understanding Gate threshold (MIN_SESSIONS, currently 5)
  scope: "self" | "company"; // "company" only when an admin asked for it (else falls back to self)
  metrics: Record<string, MetricResult>; // e.g. conversionRate, winLossRatio, quotaAttainment, cueAcceptanceRate…
  deltas: Record<string, number | null>; // recent-half vs prior-half self-comparison per session metric
  sessions: Record<string, { label: string | null; startedAt: string; outcome: string | null }>;
}

// ── Trajectory contract (GET /api/coach/kpi/trajectory) ─────────────────────────────────────────────────────
// Grounded in TeamPilot's src/lib/coach/kpi/trajectory.ts. Built from FROZEN monthly snapshots, never the live
// rollup, so the series is a real longitudinal record rather than today's number repeated backwards.

/** One frozen month for one metric. `value` is null for a month that was still building. */
export interface TrajectoryPoint {
  period: string; // 'YYYY-MM'
  value: number | null;
  sampleSize: number;
}

export interface MetricTrajectory {
  metric: string;
  layer: number;
  /** Chronological, period ascending. May contain null values. */
  points: TrajectoryPoint[];
  /** Most recent NON-NULL value, or null if the metric never resolved. */
  latest: number | null;
  /** The non-null value immediately before `latest`. */
  previous: number | null;
  /** latest − previous, and null unless BOTH exist — never a delta against nothing. */
  delta: number | null;
  monthsWithData: number;
}

export interface TrajectoryResponse {
  /** True while too few distinct months exist to draw a trend at all. */
  building: boolean;
  monthsCovered: number;
  metrics: MetricTrajectory[];
}

// ── Team roster contract (GET /api/coach/kpi/team) ──────────────────────────────────────────────────────────
// Grounded in TeamPilot's src/app/api/coach/kpi/team/route.ts. Manager-gated: a non-manager gets 403 with
// "Manager access required." Every metric is a MetricResult, so the same gated/building rules apply as on /me.

export interface TeamAgent {
  agentId: string;
  /** May be null when a profile has no name set. */
  name: string | null;
  /** Org tier, and the roster's default sort key. */
  companyRole: string | null;
  sessionCount: number;
  firstSessionAt: string | null;
  /** True while the rep has too few calls for a slipping comparison to mean anything. */
  establishingBaseline: boolean;
  conversionRate: MetricResult;
  relianceReduction: MetricResult;
  quotaAttainment: MetricResult;
  objectionsPerSession: MetricResult;
  objectionResolutionRate: MetricResult;
  recommendationUptake: MetricResult;
  followUpRate: MetricResult;
  salesCycleLength: MetricResult;
  /** The SERVER's verdict that this rep has dropped against their own baseline. */
  slipping: boolean;
  /** Which dimensions triggered it — e.g. ["conversion", "quality"]. */
  slippingReasons: string[];
}

export interface TeamResponse {
  agents: TeamAgent[];
  /** The drop, in percent, the server treats as slipping. */
  alertDropPct: number;
  monthlyQuotaTarget: number;
}
