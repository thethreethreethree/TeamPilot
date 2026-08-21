import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";
import { selectWinningLines } from "@/lib/coach/v5/winningLines";
import { isMissingColumnError } from "@/lib/coach/v5/migrationGuard";

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
  // Coaching kind (migration 0237): 'sales' | 'meeting' | 'huddle'. Distinct from `context` (where the call
  // happens). Drives strategy selection (resolveCoachingMode → selectStrategy). Defaults 'sales' for pre-0237
  // rows and any legacy value, so the sales path is unchanged.
  sessionKind: string;
  clientLabel: string | null;
  status: SalesSessionStatus;
  audioAssetUrl: string | null;
  // Real audio length (whole seconds) of an UPLOADED recording, captured from the transcription word
  // timestamps (0210). NULL for live-coaching sessions — their conversation length is the started..ended
  // wall-clock, which is correct. Consumers prefer this when present so an upload shows its true length.
  audioDurationSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
  // Phase 2 capture (all optional). when = startedAt; why = derived (Phase 3).
  territory: string | null; // WHERE
  approach: string | null; // HOW
  offer: string | null; // WHAT
  outcome: SalesOutcome | null; // downstream result (recorded after the call)
  dealValue: number | null; // deal value when sold (Layer-1 KPI source, 0205). null = not recorded.
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
    // A34 migration-coupling: session_kind may be absent on a pre-0237 row → default 'sales'.
    sessionKind: (row.session_kind as string | null) ?? "sales",
    clientLabel: (row.client_label as string | null) ?? null,
    status: row.status as SalesSessionStatus,
    audioAssetUrl: (row.audio_asset_url as string | null) ?? null,
    audioDurationSeconds: (row.audio_duration_seconds as number | null) ?? null,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string | null) ?? null,
    territory: (row.territory as string | null) ?? null,
    approach: (row.approach as string | null) ?? null,
    offer: (row.offer as string | null) ?? null,
    outcome: (row.outcome as SalesOutcome | null) ?? null,
    dealValue:
      row.deal_value === null || row.deal_value === undefined
        ? null
        : Number(row.deal_value),
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
  // Coaching kind (migration 0237): 'sales' (default) | 'meeting' | 'huddle'.
  sessionKind?: string;
  // Phase 2 capture, all optional (only the title is required).
  territory?: string | null;
  approach?: string | null;
  offer?: string | null;
}): Promise<SalesSession | null> {
  const sb = createServiceRoleClient();
  const base = {
    company_id: args.companyId,
    agent_id: args.agentId,
    context: args.context,
    client_label: args.clientLabel ?? null,
    territory: args.territory ?? null,
    approach: args.approach ?? null,
    offer: args.offer ?? null,
  };
  // A34 migration-coupling: only WRITE session_kind for a non-default (meeting/huddle) session. The sales path
  // omits it entirely → byte-identical to pre-0237 and cannot fail if the column isn't applied yet. A meeting
  // session DOES write it and so fails HONESTLY on a pre-0237 DB (correct — a meeting can't exist before 0237).
  const insertData =
    args.sessionKind && args.sessionKind !== "sales"
      ? ({ ...base, session_kind: args.sessionKind } as typeof base)
      : base;
  const { data, error } = await sb
    .from("coaching_sessions")
    .insert(insertData)
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
/** Rename a session's client/campaign label (spec 1b: name it AFTER recording,
 *  once the rep knows what the call actually was). Service-role write; the PATCH
 *  route authorizes via an RLS-scoped getSession before calling this. */
export async function renameSession(
  sessionId: string,
  clientLabel: string
): Promise<SalesSession | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("coaching_sessions")
    .update({ client_label: clientLabel })
    .eq("id", sessionId)
    .select("*")
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.renameSession] failed session=${sessionId}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  return mapSession(data);
}

export async function setSessionStatus(args: {
  sessionId: string;
  status: Exclude<SalesSessionStatus, "active">;
  // Who triggered the transition; defaults to the session's agent.
  actorId?: string | null;
}): Promise<SalesSession | null> {
  // Deliberately does NOT write audio_asset_url. That column is owned solely by
  // the upload-recording route, which stores the bucket-relative shape the
  // recording-purge cron can delete. A status transition setting the audio
  // pointer to an arbitrary (full-URL) shape would have produced audio the
  // retention cron can't purge — silently breaking the 2-day deletion promise.
  const sb = createServiceRoleClient();
  const patch: Record<string, unknown> = { status: args.status };
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
  /** Optional deal value (Layer-1 KPI, 0205). undefined = leave unchanged; null = clear it. */
  dealValue?: number | null;
}): Promise<SalesSession | null> {
  const sb = createServiceRoleClient();
  const update: Record<string, unknown> = { outcome: args.outcome };
  if (args.dealValue !== undefined) update.deal_value = args.dealValue;
  const { data, error } = await sb
    .from("coaching_sessions")
    .update(update)
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
      payload: {
        outcome: args.outcome,
        ...(args.dealValue !== undefined ? { dealValue: args.dealValue } : {}),
      },
    });
  } catch {
    /* best-effort — the outcome column is already set */
  }
  return mapSession(data);
}

/** Append one diarized transcript segment (immutable). `source` (0236) records WHY the speaker was assigned. */
export async function appendTranscriptSegment(args: {
  sessionId: string;
  speaker: TranscriptSpeaker;
  text: string;
  seq: number;
  spokenAt?: string | null;
  source?: string | null;
}): Promise<TranscriptSegment | null> {
  const sb = createServiceRoleClient();
  const base = {
    session_id: args.sessionId,
    speaker: args.speaker,
    text: args.text,
    seq: args.seq,
    spoken_at: args.spokenAt ?? null,
  };
  // `source` is a real column (0236) but the generated Supabase types predate it, so cast to the pre-0236 row
  // shape — the extra property is sent at runtime, and the migration-coupling guard below covers an env where
  // the column isn't applied.
  let { data, error } = await sb
    .from("coaching_transcript_segments")
    .insert((args.source ? { ...base, source: args.source } : base) as typeof base)
    .select("*")
    .single();
  // Migration-coupling guard (A34): if `source` (0236) isn't applied in this env, retry WITHOUT it rather than
  // LOSING the segment — the transcript matters far more than the diagnostic source. (Column IS live in prod;
  // this is belt-and-braces so a deploy-before-migrate can never regress capture. [[feedback_migration_coupling_no_assert]])
  if (error && args.source && isMissingColumnError(error, "source")) {
    ({ data, error } = await sb.from("coaching_transcript_segments").insert(base).select("*").single());
  }
  if (error) {
    // 23505 = a segment for this (session_id, seq) already exists (migration 0208's unique constraint).
    // That means a re-finalize / hook remount replayed the transcript — an idempotent NO-OP (first-take
    // stands), NOT a failure, so don't log it. The finalize loop counts only newly-inserted segments, so
    // returning null here correctly reports "0 new" for the replay. (Safe before 0208 applies too: without
    // the constraint there is no 23505, so the plain insert path is unchanged.)
    if (error.code === "23505") return null;
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.appendTranscriptSegment] failed session=${args.sessionId}: ${error.message}`
    );
    return null;
  }
  if (!data) return null;
  return mapSegment(data);
}

/**
 * ATOMICALLY replace a session's transcript — delete all existing segments + insert `segments` in ONE
 * transaction (the `replace_session_transcript` RPC, migration 0212). Use this for the RECOVERY OVERWRITE of a
 * broken/one-sided transcript instead of a delete-then-append pair: a delete-then-append can destroy the
 * original and then fail the re-insert (appendTranscriptSegment swallows errors), leaving the transcript
 * destroyed-and-unreplaced (or a locked partial). The RPC rolls the whole thing back on any error, so the
 * original always survives a failed replace. Service-role; the CALLER gates owner + the one-sided precondition.
 * Returns { ok, count } — ok:false means nothing changed (the original stands).
 */
export async function replaceSessionTranscript(
  sessionId: string,
  segments: { speaker: TranscriptSpeaker; text: string; seq: number }[]
): Promise<{ ok: boolean; count: number }> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.rpc("replace_session_transcript", {
    p_session_id: sessionId,
    p_segments: segments.map((s) => ({ speaker: s.speaker, text: s.text, seq: s.seq })),
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[salesCoach.replaceSessionTranscript] failed session=${sessionId}: ${error.message}`
    );
    return { ok: false, count: 0 };
  }
  return { ok: true, count: typeof data === "number" ? data : segments.length };
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
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  // Classify: `null` means the session genuinely doesn't exist (routes 404). A transient error must NOT collapse
  // to null → a false 404 that makes a live coaching session look deleted (error-as-no-data, INV22 / §3.4).
  // Throw so the route surfaces a 500. Fail-closed: a throw denies, never grants.
  if (error) throw new Error(`Failed to load the coaching session: ${error.message}`);
  return data ? mapSession(data) : null;
}

/** Full ordered transcript for a session (RLS-scoped). */
export async function getSessionTranscript(
  sessionId: string
): Promise<TranscriptSegment[]> {
  const sb = await createServerClient();
  const { data, error } = await sb
    .from("coaching_transcript_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  // Throw on a transient read error — an EMPTY transcript on error is error-as-no-data (INV22 / §3.4), and it's
  // acute here: review/dissect/summarize routes would generate a coaching review from NOTHING and persist it.
  if (error) throw new Error(`Failed to load the session transcript: ${error.message}`);
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
  const { data, error } = await sb
    .from("coaching_transcript_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  // Same as the RLS variant: throw on error so the skills/backfill caller doesn't compute over an empty
  // transcript and persist a false result (error-as-no-data, INV22 / §3.4).
  if (error) throw new Error(`Failed to load the session transcript: ${error.message}`);
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
  const { data, error } = await sb
    .from("coaching_cues")
    .select("*")
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: true });
  // Error-as-no-data guard: the After Pitch assembler must not build a summary from ZERO cues because a
  // transient read failed (that would silently understate the call). Fail closed; reserve [] for a cue-less session.
  if (error) throw new Error(`Failed to load session cues: ${error.message}`);
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
  const { data, error } = await sb
    .from("coaching_cue_outcomes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  // Error-as-no-data guard: an error here would read as "every cue had no outcome" and understate the followed
  // cues in the summary. Fail closed; reserve [] for a session with genuinely no recorded outcomes.
  if (error) throw new Error(`Failed to load cue outcomes: ${error.message}`);
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
  const { data, error } = await sb
    .from("after_pitch_summaries")
    .select("payload")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Error-as-no-data guard: on error, null would read as "no summary yet" and the route would regenerate or
  // show blank over an existing one. Fail closed; reserve null for a session that genuinely has no summary.
  if (error) throw new Error(`Failed to load the after-pitch summary: ${error.message}`);
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
  const { data, error } = await sb
    .from("after_pitch_summaries")
    .select("session_id, payload")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  // Error-as-no-data guard: the personal skills/analytics aggregation must not read a transient error as the
  // rep having "no history yet". Fail closed; reserve [] for a rep with genuinely no summaries.
  if (error) throw new Error(`Failed to load the rep's after-pitch summaries: ${error.message}`);
  return (data ?? []).map((r) => ({
    sessionId: r.session_id as string,
    payload: r.payload,
  }));
}

/** When this agent FIRST started using the coach — the earliest session's
 *  started_at (ISO), or null if they have none yet. Anchors the 3-day silent-
 *  observe window (spec 4.3a: the AI listens for 3 days, then starts advising).
 *  Service-role: the cue route authorizes the session before using this. */
export async function getAgentCoachStart(agentId: string): Promise<string | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("started_at")
    .eq("agent_id", agentId)
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  // Error-as-no-data guard: null legitimately means "no sessions yet" (anchors the 3-day observe window). An
  // error masked as null would RESET that window — the coach would treat a veteran rep as brand new. Fail closed.
  if (error) throw new Error(`Failed to load the agent's coach start: ${error.message}`);
  return (data?.started_at as string | null) ?? null;
}

/** An agent's sessions, most recent first (RLS-scoped). */
export async function listAgentSessions(
  agentId: string,
  limit = 50
): Promise<SalesSession[]> {
  const sb = await createServerClient();
  const { data, error } = await sb
    .from("coaching_sessions")
    .select("*")
    .eq("agent_id", agentId)
    .order("started_at", { ascending: false })
    .limit(limit);
  // Error-as-no-data guard: on error, [] would render the rep's ENTIRE session history as empty ("your data is
  // gone"). Fail closed so the route surfaces it; reserve [] for a rep who genuinely has no sessions.
  if (error) throw new Error(`Failed to load the agent's sessions: ${error.message}`);
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
