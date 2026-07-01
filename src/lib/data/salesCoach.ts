import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";

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
  latencyMs?: number | null;
}): Promise<Cue | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb
    .from("coaching_cues")
    .insert({
      session_id: args.sessionId,
      mode: args.mode,
      text: args.text,
      latency_ms: args.latencyMs ?? null,
    })
    .select("*")
    .single();
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
  const { data: sessions } = await sb
    .from("coaching_sessions")
    .select("id, started_at")
    .eq("agent_id", agentId)
    .in("status", ["ended", "reviewed"])
    .order("started_at", { ascending: true })
    .limit(limit);
  if (!sessions || sessions.length === 0) return [];

  const out: Array<{ sessionId: string; startedAt: string; cueCount: number }> = [];
  for (const s of sessions) {
    const { count } = await sb
      .from("coaching_cues")
      .select("id", { count: "exact", head: true })
      .eq("session_id", s.id as string);
    out.push({
      sessionId: s.id as string,
      startedAt: s.started_at as string,
      cueCount: count ?? 0,
    });
  }
  return out;
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
