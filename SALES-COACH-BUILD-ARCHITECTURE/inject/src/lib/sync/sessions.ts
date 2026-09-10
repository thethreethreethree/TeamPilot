// sync/sessions.ts — reading the signed-in rep's coaching data DIRECTLY from Supabase, under the Row-Level
// Security the backend already enforces. This is the Phase-1 sync path: it needs NO backend change, because the
// existing RLS policies let a user read their own sessions (and a manager read their company's).
//
// WHY direct-Supabase for reads (not an API route): the SELECT policies on coaching_sessions / segments / cues
// already scope to `agent_id = auth.uid()` (owner) OR company-admin/manager. So `supabase.from(...).select()`
// with the user's session returns exactly their rows and nothing else — the same data the web app shows, live,
// with real-time + offline caching available from the client library. No second endpoint to build or secure.
//
// WHAT still goes through the API (not here): anything that RUNS server logic — AI suggestions (coach-api.ts),
// audio transcription, KPI computation. Those reuse the server's single source of truth rather than a second
// copy on the device (your §2.2 "consume the verdict, don't re-derive" rule — a re-implemented KPI formula is a
// drift bug waiting to happen). KPIs light up when the Phase-2 Bearer shim exposes /api/coach/kpi/me to the app.

import { supabase } from "../supabase";
import type { CoachingSession, TranscriptSegment, CoachingCue } from "@/types/backend";

/** The signed-in rep's own sessions, newest first. RLS guarantees these are theirs (or their company's if manager). */
export async function listMySessions(limit = 50): Promise<CoachingSession[]> {
  const { data, error } = await supabase
    .from("coaching_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CoachingSession[];
}

/** One session by id (RLS enforces ownership/visibility — a foreign id returns nothing, not someone else's row). */
export async function getSession(id: string): Promise<CoachingSession | null> {
  const { data, error } = await supabase.from("coaching_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as CoachingSession) ?? null;
}

/** A session's transcript, in order. Append-only on the server, so this only ever grows. */
export async function getTranscript(sessionId: string): Promise<TranscriptSegment[]> {
  const { data, error } = await supabase
    .from("coaching_transcript_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TranscriptSegment[];
}

/** The in-call cues the coach delivered for a session. */
export async function getCues(sessionId: string): Promise<CoachingCue[]> {
  const { data, error } = await supabase
    .from("coaching_cues")
    .select("*")
    .eq("session_id", sessionId)
    .order("delivered_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CoachingCue[];
}

/**
 * Live updates: subscribe to new sessions for this rep and re-render as they land (e.g. a call recorded on
 * another device syncs in). Returns an unsubscribe function. Realtime respects the same RLS as the reads.
 *
 * ⚠️ PRECONDITION (verify before relying on this): `coaching_sessions` must be in the `supabase_realtime`
 * publication. As of this writing NO migration in the backend adds it, so realtime is very likely OFF for this
 * table — the subscription will connect but NEVER fire. Enable it once (Supabase Dashboard → Database →
 * Replication, or `alter publication supabase_realtime add table public.coaching_sessions;`). Until then,
 * treat realtime as an enhancement and make **stale-while-revalidate polling** (re-call listMySessions on focus /
 * pull-to-refresh) your reliable baseline — do NOT present realtime as guaranteed live.
 */
export function subscribeMySessions(onChange: () => void): () => void {
  const channel = supabase
    .channel("my-coaching-sessions")
    .on("postgres_changes", { event: "*", schema: "public", table: "coaching_sessions" }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
