// backend.ts — TypeScript shapes for the Elostate coaching backend, mirrored from the server data layer
// (src/lib/data/salesCoach.ts and the migrations). Keep these in sync with the server; they are the app's
// contract for the tables it reads directly via Supabase and the JSON the coach routes return.
//
// Columns are grounded in supabase/migrations/0070 (foundation), 0077 (capture: territory/approach/offer/
// outcome), 0205 (deal_value), 0210 (audio_duration_seconds), 0236 (segment source), 0237 (session_kind).

export type SessionContext = "in_person" | "video";
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

// ── KPI contract (Phase 3 — needs the Bearer shim) ────────────────────────────────────────────────────────
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
