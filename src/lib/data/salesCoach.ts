import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";
import { selectWinningLines } from "@/lib/coach/v5/winningLines";

/**
 * Live Sales Coach — data layer (subsystem 2: Recording & Storage).
 *
 * Append-only by contract (§3.1 + the founder's data-as-asset rule):
 * transcript segments and cues are written, never edited or deleted
 * (the DB enforces this with rules in migration 0070 — these functions
 * only ever INSERT). Session status is the one mutable field, and only
 * forward ('active' → 'ended' → 'reviewed').
 *
 * The real-time pipeline (subsystem 1, a later increment) writes
 * transcript segments + cues through the service-role client as audio
 * is transcribed. The post-call review engine + the agent dashboard
 * read through these functions.
 */

export type SalesContext = "in_person" | "video";
export type SalesSessionStatus = "active" | "ended" | "reviewed";
export type TranscriptSpeaker = "agent" | "customer" | "unknown";
export type CueMode = "suggestion" | "guide_response";

// Phase 2 capture — the downstream result of a call. §3.5: the consequence
// the differentiated metric anchors to. Small, revisable set (founder may
// extend); no_contact = door not answered / prospect unreachable.
export type SalesOutcome =
  | "sold"
  | "follow_up"
  | "no_sale"
  | "no_contact"
  | "undecided";
export const SALES_OUTCOMES: SalesOutcome[] = [
  "sold",
  "follow_up",
  "no_sale",
  "no_contact",
  "undecided",
];

export type SalesSession = {
  id: string;
  companyId: string;
  agentId: string;
  context: SalesContext;
  clientLabel: string | null;
  status: SalesSessionStatus;
  audioAssetUrl: string | null;
  startedAt: string;
  endedAt: string | null;
  // Phase 2 capture (all optional). when = startedAt; why = derived (Phase 3).
  territory: string | null; // WHERE
  approach: string | null; // HOW
  offer: string | null; // WHAT
  outcome: SalesOutcome | null; // downstream result (recorded after the call)
};

export type TranscriptSegment = {
  id: string;
  sessionId: string;
  speaker: TranscriptSpeaker;
  text: string;
  seq: number;
  spokenAt: string | null;
};

export type Cue = {
  id: string;
  sessionId: string;
  mode: CueMode;
  text: string;
  deliveredAt: string;
  latencyMs: number | null;
};

// After Pitch Summary (0080) — the closed cue→behaviour loop. `source` is
// load-bearing (§3.4): 'rep_marked' is a rep-confirmed follow (the live "used
// it" tap); 'inferred' is the post-call engine's read of what the rep did
// after the cue, and must never be presented as confirmed.
export type CueOutcomeDetermination = "followed" | "partial" | "ignored";
export type CueOutcomeSource = "rep_marked" | "inferred";
export type CueOutcome = {
  id: string;
  cueId: string;
  sessionId: string;
  determination: CueOutcomeDetermination;
  source: CueOutcomeSource;
  evidence: string | null;
  createdAt: string;
};

function mapSession(row: Record<string, unknown>): SalesSession {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    agentId: row.agent_id as string,
    context: row.context as SalesContext,
    clientLabel: (row.client_label as string | null) ?? null,
    status: row.status as SalesSessionStatus,
    audioAssetUrl: (row.audio_asset_url as string | null) ?? null,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
    territory: (row.territory as string | null) ?? null,
    approach: (row.approach as string | null) ?? null,
    offer: (row.offer as string | null) ?? null,
    outcome: (row.outcome as SalesOutcome | null) ?? null,
  };
}

function mapSegment(row: Record<string, unknown>): TranscriptSegment {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    speaker: row.speaker as TranscriptSpeaker,
    text: row.text as string,
    seq: row.seq as number,
    spokenAt: (row.spoken_at as string | null) ?? null,
  };
}

function mapCue(row: Record<string, unknown>): Cue {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    mode: row.mode as CueMode,
    text: row.text as string,
    deliveredAt: row.delivered_at as string,
    latencyMs: (row.latency_ms as number | null) ?? null,
  };
}

/** Start a session. Service-role: the realtime pipeline opens this as a
 *  call begins. */
export async function createSession(args: {
  companyId: string;
  agentId: string;
  context: SalesContext;
  clientLabel?: string | null;
  // Phase 2 capture, all optional (only the title is required).
  territory?: string | null;
  approach?: string | null;
  offer?: string | null;
}): Promise<SalesSession | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("coaching_sessions")
    .insert({
      company_id: args.companyId,
      agent_id: args.agentId,
      context: args.context,
      client_label: args.clientLabel ?? null,
      territory: args.territory ?? null,
      approach: args.approach ?? null,
      offer: args.offer ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.createSession] failed agent=${args.agentId}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  return mapSession(data);
}

/** Forward-only status transition. Returns the updated row, or null on
 *  failure (the trigger stamps ended_at). */
export async function setSessionStatus(args: {
  sessionId: string;
  status: Exclude<SalesSessionStatus, "active">;
  audioAssetUrl?: string | null;
  // Who triggered the transition; defaults to the session's agent.
  actorId?: string | null;
}): Promise<SalesSession | null> {
  const sb = createServiceRoleClient();
  const patch: Record<string, unknown> = { status: args.status };
  if (args.audioAssetUrl !== undefined) patch.audio_asset_url = args.audioAssetUrl;
  const { data, error } = await sb
    .from("coaching_sessions")
    .update(patch)
    .eq("id", args.sessionId)
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.setSessionStatus] failed session=${args.sessionId}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  // F2 (§3.1) — the lifecycle transition on the append-only record, mirroring
  // setSessionOutcome. Best-effort: the column write is the visible result.
  try {
    await sb.from("events").insert({
      company_id: data.company_id,
      actor: args.actorId ?? (data.agent_id as string),
      kind: "coach.session_status_changed",
      subject: `sales_session:${args.sessionId}`,
      payload: { status: args.status },
    });
  } catch {
    /* best-effort — the status column is already set */
  }
  return mapSession(data);
}

/** Record the call OUTCOME (Phase 2 capture). Updates the column (the
 *  derived current state, for display/filter) AND appends an immutable
 *  `coach.session_outcome_recorded` event (§3.1) so the §3.5 consequence
 *  measurement + the Phase 3 WHY engine replay the full history — including
 *  a correction (record then re-record appends a second event; the column
 *  holds the latest). */
export async function setSessionOutcome(args: {
  sessionId: string;
  outcome: SalesOutcome;
  actorId: string;
}): Promise<SalesSession | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("coaching_sessions")
    .update({ outcome: args.outcome })
    .eq("id", args.sessionId)
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.setSessionOutcome] failed session=${args.sessionId}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  // Append-only record of the consequence (§3.1/§3.5). Best-effort: the
  // column write is the user-visible result; a failed event must not undo it.
  try {
    await sb.from("events").insert({
      company_id: data.company_id,
      actor: args.actorId,
      kind: "coach.session_outcome_recorded",
      subject: `sales_session:${args.sessionId}`,
      payload: { outcome: args.outcome },
    });
  } catch {
    /* best-effort — the outcome column is already set */
  }
  return mapSession(data);
}

/** Append one diarized transcript segment (immutable). */
export async function appendTranscriptSegment(args: {
  sessionId: string;
  speaker: TranscriptSpeaker;
  text: string;
  seq: number;
  spokenAt?: string | null;
}): Promise<TranscriptSegment | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("coaching_transcript_segments")
    .insert({
      session_id: args.sessionId,
      speaker: args.speaker,
      text: args.text,
      seq: args.seq,
      spoken_at: args.spokenAt ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.appendTranscriptSegment] failed session=${args.sessionId}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  return mapSegment(data);
}

/** Append one delivered cue (immutable record of live coaching). */
export async function appendCue(args: {
  sessionId: string;
  mode: CueMode;
  text: string;
  // If/when this is wired from the fluidity instrumentation: persist the CLIENT's
  // true END-TO-END total (triggeredAt→delivered, settle+llm+tts), NOT a
  // server-only LLM duration — else it repeats audit Finding A (2026-07-06), a
  // latency number that silently excludes a pipeline stage.
  latencyMs?: number | null;
  // Audit F1 (§4/§1.1) — WHY this cue fired, so build 4 can validate against
  // outcomes. trigger = objection|filler_spike|pace_spike|stall|…; signal =
  // the measured stress signal (build 3), when present.
  trigger?: string | null;
  signal?: unknown;
}): Promise<Cue | null> {
  const sb = createServiceRoleClient();
  const base = {
    session_id: args.sessionId,
    mode: args.mode,
    text: args.text,
    latency_ms: args.latencyMs ?? null,
  };
  let { data, error } = await sb
    .from("coaching_cues")
    .insert({
      ...base,
      trigger: args.trigger ?? null,
      signal: (args.signal ?? null) as never,
    })
    .select("*")
    .single();
  // F1 defensive (§1.5) — the trigger/signal columns may not exist yet
  // (pre-0079). Fall back to the legacy insert so the §3.5 cue-reliance
  // signal keeps recording through the migration window. Self-heals once
  // 0079 is applied.
  if (error) {
    ({ data, error } = await sb
      .from("coaching_cues")
      .insert(base)
      .select("*")
      .single());
  }
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.appendCue] failed session=${args.sessionId}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  return mapCue(data);
}

/** Read a session (RLS-scoped — caller must be in the same company). */
export async function getSession(sessionId: string): Promise<SalesSession | null> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("coaching_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  return data ? mapSession(data) : null;
}

/** Full ordered transcript for a session (RLS-scoped). */
export async function getSessionTranscript(
  sessionId: string
): Promise<TranscriptSegment[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("coaching_transcript_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  return (data ?? []).map(mapSegment);
}

/** Service-role transcript read for contexts with NO user session (the
 *  backfill cron). getSessionTranscript uses the RLS user client, which
 *  returns nothing under a cron's Bearer-only auth — this reads the same
 *  rows via the admin client. Access is gated upstream by the caller. */
export async function getSessionTranscriptAdmin(
  sessionId: string
): Promise<TranscriptSegment[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("coaching_transcript_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  return (data ?? []).map(mapSegment);
}

function mapCueOutcome(row: Record<string, unknown>): CueOutcome {
  return {
    id: row.id as string,
    cueId: row.cue_id as string,
    sessionId: row.session_id as string,
    determination: row.determination as CueOutcomeDetermination,
    source: row.source as CueOutcomeSource,
    evidence: (row.evidence as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Delivered cues for a session, oldest → newest (RLS-scoped user read).
 *  Used by surfaces; the After Pitch assembler uses the admin read below. */
export async function getSessionCues(sessionId: string): Promise<Cue[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("coaching_cues")
    .select("*")
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: true });
  return (data ?? []).map(mapCue);
}

/** Service-role cue read for the post-call summary assembler (no user
 *  session in some contexts, mirrors getSessionTranscriptAdmin). Access is
 *  gated upstream by the route (caller must be the session's agent). */
export async function getSessionCuesAdmin(sessionId: string): Promise<Cue[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("coaching_cues")
    .select("*")
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: true });
  return (data ?? []).map(mapCue);
}

/** Append one cue outcome (immutable, §3.1). Service role — written by the
 *  live "used it" tap route (source='rep_marked') and by the post-call
 *  inference (source='inferred'). */
export async function appendCueOutcome(args: {
  cueId: string;
  sessionId: string;
  determination: CueOutcomeDetermination;
  source: CueOutcomeSource;
  evidence?: string | null;
  createdBy?: string | null;
}): Promise<CueOutcome | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("coaching_cue_outcomes")
    .insert({
      cue_id: args.cueId,
      session_id: args.sessionId,
      determination: args.determination,
      source: args.source,
      evidence: args.evidence ?? null,
      created_by: args.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.appendCueOutcome] failed cue=${args.cueId}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  return mapCueOutcome(data);
}

/** Latest outcome per cue for a session (service role, for the assembler).
 *  Append-only means a cue may have multiple outcomes (e.g. a rep_marked tap
 *  plus a later inferred read); the LATEST wins, and a rep_marked confirmation
 *  is preferred over an inference for the same cue. */
export async function getSessionCueOutcomesAdmin(
  sessionId: string
): Promise<CueOutcome[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("coaching_cue_outcomes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  const rows = (data ?? []).map(mapCueOutcome);
  // Collapse to the current determination per cue: prefer a rep_marked
  // confirmation; otherwise the most recent (rows are newest-first).
  const byCue = new Map<string, CueOutcome>();
  for (const o of rows) {
    const existing = byCue.get(o.cueId);
    if (!existing) {
      byCue.set(o.cueId, o);
    } else if (existing.source !== "rep_marked" && o.source === "rep_marked") {
      byCue.set(o.cueId, o);
    }
  }
  return Array.from(byCue.values());
}

/**
 * The rep's own PROVEN lines: cue texts this agent FOLLOWED (rep-confirmed) in
 * sessions that ended SOLD. Grounds the live cue in what THIS rep has actually
 * closed with (§A8 growth-participant, §3.6), not just generic methodology.
 * Service-role (the live-cue path is server-side). Compact + recent — the caller
 * caches this per session, so the 3 small queries run once, not per cue (no
 * per-cue latency).
 */
export async function getRepWinningLines(args: {
  companyId: string;
  agentId: string;
  limit?: number;
}): Promise<string[]> {
  const sb = createServiceRoleClient();
  // 1. This rep's SOLD sessions (bounded).
  const { data: sessions } = await sb
    .from("coaching_sessions")
    .select("id")
    .eq("company_id", args.companyId)
    .eq("agent_id", args.agentId)
    .eq("outcome", "sold")
    .order("started_at", { ascending: false })
    .limit(30);
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  if (sessionIds.length === 0) return [];
  // 2. Cues the rep FOLLOWED in those sessions — by the cue's LATEST outcome.
  //    A5 fix (audit 2026-07-09): filtering `determination='followed'` in the query
  //    matched ANY followed row, even one later superseded by a correction, so a
  //    stale "winning line" the rep no longer used could resurface. Instead pull ALL
  //    determinations and collapse per cue (rep_marked authoritative, else newest —
  //    same rule as getSessionCueOutcomesAdmin), then keep only cues whose CURRENT
  //    determination is 'followed'.
  const { data: outcomes } = await sb
    .from("coaching_cue_outcomes")
    .select("cue_id, created_at, source, determination")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: false })
    .limit(200);
  const latestByCue = new Map<string, { source: string; determination: string }>();
  for (const o of outcomes ?? []) {
    const cueId = o.cue_id as string;
    const source = o.source as string;
    const determination = o.determination as string;
    const existing = latestByCue.get(cueId);
    if (!existing) {
      latestByCue.set(cueId, { source, determination }); // desc order → newest first
      continue;
    }
    // rep_marked (explicit rep tap) overrides an inferred outcome even if newer.
    if (source === "rep_marked" && existing.source !== "rep_marked") {
      latestByCue.set(cueId, { source, determination });
    }
  }
  const rows = Array.from(latestByCue.entries())
    .filter(([, v]) => v.determination === "followed")
    .map(([cue_id, v]) => ({ cue_id, source: v.source }));
  const cueIds = Array.from(new Set(rows.map((o) => o.cue_id)));
  if (cueIds.length === 0) return [];
  // 3. The cue texts.
  const { data: cues } = await sb
    .from("coaching_cues")
    .select("id, text")
    .in("id", cueIds);
  const textById = new Map<string, string>();
  for (const c of cues ?? []) {
    const t = (c.text as string | null)?.trim();
    if (t) textById.set(c.id as string, t);
  }
  // §3.5 rank (rep-confirmed first) + dedup + cap — pure, tested in winningLines.ts.
  return selectWinningLines(rows, textById, args.limit ?? 5);
}

/** Persist an assembled After Pitch Summary (append-only, §3.1). Service
 *  role — the row's privacy is enforced on READ by the owner-only RLS policy
 *  (0080); the route verifies the caller is the session's agent before this
 *  runs. Returns true on success. */
export async function saveAfterPitchSummary(args: {
  sessionId: string;
  companyId: string;
  agentId: string;
  payload: unknown;
}): Promise<boolean> {
  const sb = createServiceRoleClient();
  const { error } = await sb.from("after_pitch_summaries").insert({
    session_id: args.sessionId,
    company_id: args.companyId,
    agent_id: args.agentId,
    payload: args.payload as never,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.saveAfterPitchSummary] failed session=${args.sessionId}: ${error.message}`
    );
  }
  return !error;
}

/** Read back the latest After Pitch Summary for a session (RLS owner-only —
 *  a manager reading this gets null by policy, which is the privacy contract).
 *  Returns the stored payload or null. */
export async function getLatestAfterPitchSummary(
  sessionId: string
): Promise<unknown | null> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("after_pitch_summaries")
    .select("payload")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.payload ?? null;
}

/** Service-role read of the latest summary (bypasses the owner-only RLS).
 *  Used by the route ONLY after it has verified the caller is the session's
 *  rep OR a same-company manager — and for a manager the route STRIPS the
 *  private scores before returning (A18). Never expose this raw. */
export async function getLatestAfterPitchSummaryAdmin(
  sessionId: string
): Promise<unknown | null> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("after_pitch_summaries")
    .select("payload")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.payload ?? null;
}

/** An agent's recent after-pitch summaries (payload + session id), newest first.
 *  Service-role: the personal Analytics aggregation reads across the rep's own
 *  sessions; the API route authorizes that the caller IS this agent before use. */
export async function getRecentAfterPitchSummariesAdmin(
  agentId: string,
  limit = 20
): Promise<{ sessionId: string; payload: unknown }[]> {
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("after_pitch_summaries")
    .select("session_id, payload")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    sessionId: r.session_id as string,
    payload: r.payload,
  }));
}

/** An agent's sessions, most recent first (RLS-scoped). */
export async function listAgentSessions(
  agentId: string,
  limit = 50
): Promise<SalesSession[]> {
  const sb = await createServerClient();
  const { data } = await sb
    .from("coaching_sessions")
    .select("*")
    .eq("agent_id", agentId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapSession);
}

/**
 * Cue-reliance signal (§3.5 + the founder's "training wheels come off"
 * intent): cue count per ended/reviewed session for an agent, oldest →
 * newest. A downward trend is the trackable "needs fewer cues over time"
 * progress signal. Derived, not stored as a mutable scorecard (§3.1).
 *
 * Returns one entry per session with its cue count; the consuming
 * surface computes the trend. Honest about sparsity — a single session
 * is not a trend, and this function does not pretend otherwise (the
 * caller decides how many sessions constitute a signal).
 */
export async function getCueRelianceSeries(
  agentId: string,
  limit = 30
): Promise<Array<{ sessionId: string; startedAt: string; cueCount: number }>> {
  const sb = await createServerClient();
  const { data: sessions, error: eSessions } = await sb
    .from("coaching_sessions")
    .select("id, started_at")
    .eq("agent_id", agentId)
    .in("status", ["ended", "reviewed"])
    .order("started_at", { ascending: true })
    .limit(limit);
  if (eSessions) {
    // §3.4 observability (audit 2026-07-09): this read is swallowed (returns []
    // below on error, rendering the cue-reliance chart's soft "not enough
    // sessions" empty state). Kept non-throwing (2 callers), but LOG the real
    // cause so a failure isn't invisible — matching the cue-row cap log below.
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.getCueRelianceSeries] sessions read failed for agent=${agentId} — reliance series renders empty. ${eSessions.message}`
    );
  }
  if (!sessions || sessions.length === 0) return [];

  // Perf (audit "same class elsewhere", 2026-07-06): was N+1 — a count query per
  // session in a loop. Now ONE query for all cues across these sessions, counted
  // in memory. Behavior-preserving; bounded row fetch (session_id only).
  const sessionIds = sessions.map((s) => s.id as string);
  // A3 fix (audit 2026-07-09): an unqualified .in() is capped at PostgREST's default
  // 1000 rows. Across ≤30 cue-heavy sessions the cue rows can exceed that, silently
  // truncating the tail → some sessions undercounted → the reliance trend bends down
  // falsely. Set an explicit bound well above the realistic max and flag if it's hit.
  const CUE_ROW_CAP = 5000;
  const { data: cueRows, error: eCueRows } = await sb
    .from("coaching_cues")
    .select("session_id")
    .in("session_id", sessionIds)
    .limit(CUE_ROW_CAP);
  if (eCueRows) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.getCueRelianceSeries] cue rows read failed for agent=${agentId} — reliance counts render as zero. ${eCueRows.message}`
    );
  }
  if (cueRows && cueRows.length === CUE_ROW_CAP) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.getCueRelianceSeries] cue rows hit the ${CUE_ROW_CAP} cap for agent=${agentId} — counts may be undercounted; consider a SQL aggregate.`
    );
  }
  const countBySession = new Map<string, number>();
  for (const r of cueRows ?? []) {
    const sid = r.session_id as string;
    countBySession.set(sid, (countBySession.get(sid) ?? 0) + 1);
  }
  return sessions.map((s) => ({
    sessionId: s.id as string,
    startedAt: s.started_at as string,
    cueCount: countBySession.get(s.id as string) ?? 0,
  }));
}

// ─── Editable methodology corpus (migration 0074) ──────────────────────

export type SalesCorpus = {
  content: string;
  createdAt: string;
  createdById: string | null;
};

/**
 * The CURRENT (latest) custom methodology corpus for a company, or null
 * if none saved. Read via service role — the review engine is a system
 * operation. §3.1: this is the latest of the append-only versions, never
 * a mutable row.
 */
export type SalesCorpusKind = "methodology" | "product";

function mapCorpusRow(data: Record<string, unknown> | null): SalesCorpus | null {
  if (!data || typeof data.content !== "string" || !data.content.trim()) {
    return null;
  }
  return {
    content: data.content,
    createdAt: data.created_at as string,
    createdById: (data.created_by as string | null) ?? null,
  };
}

export async function getCurrentSalesCorpus(
  companyId: string,
  // Defaults to methodology so every existing caller (review/dissect/prep)
  // is unchanged; product knowledge (0078) is the second kind.
  kind: SalesCorpusKind = "methodology"
): Promise<SalesCorpus | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("sales_coach_corpus_versions")
    .select("content, created_at, created_by")
    .eq("company_id", companyId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // F1 (§1.5) — during the 0078 migration window the `kind` column may not
  // exist yet, so the filtered query errors. Legacy rows are ALL methodology,
  // so for the methodology read an UNFILTERED query is the correct read —
  // keep the live corpus working through the window. For 'product' there is no
  // legacy data, so an error just means "none yet" (returning a methodology
  // row here would be wrong). Falls away once 0078 is applied.
  if (error) {
    if (kind !== "methodology") return null;
    const { data: legacy } = await sb
      .from("sales_coach_corpus_versions")
      .select("content, created_at, created_by")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return mapCorpusRow(legacy);
  }
  return mapCorpusRow(data);
}

/** Append a new corpus version (immutable, §3.1). True on success. */
export async function appendSalesCorpusVersion(args: {
  companyId: string;
  content: string;
  createdBy: string;
  kind?: SalesCorpusKind;
}): Promise<boolean> {
  const sb = createServiceRoleClient();
  const { error } = await sb.from("sales_coach_corpus_versions").insert({
    company_id: args.companyId,
    content: args.content,
    created_by: args.createdBy,
    kind: args.kind ?? "methodology",
  });
  return !error;
}
