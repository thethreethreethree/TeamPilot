import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPagedResult } from "@/lib/supabase/paginate";
import { REMOTE_CONTEXTS } from "@/lib/coach/sessionContext";
import type { AdoptionCall, AdoptionHit } from "./adoption";

/**
 * The reads behind message adoption (adoption.ts), shared by one tracker's Adoption view and the board of all trackers
 * (2026-11-23) so both count the same calls the same way (§2.2). Through the CALLER's client: a manager sees their
 * tree, a rep their own calls. Paged and chunked (100 calls per request), so no capped read can cut hits.
 * Returns null on any failed read — the caller answers with an error, never a lower rate.
 */
const CHUNK = 100;

export type AdoptionInputs = { sessionsInWindow: number; calls: AdoptionCall[]; hitsByTracker: Map<string, AdoptionHit[]> };

export async function readAdoptionInputs(db: SupabaseClient, trackerIds: string[], since: string): Promise<AdoptionInputs | null> {
  const sessions = await fetchAllPagedResult<{ id: string; agent_id: string; started_at: string; context: string | null }>(
    (from, to) =>
      db.from("coaching_sessions").select("id, agent_id, started_at, context").in("context", [...REMOTE_CONTEXTS]).gte("started_at", since).order("started_at", { ascending: true }).order("id", { ascending: true }).range(from, to),
    { label: "adoption sessions" },
  );
  if (sessions.error) return null;
  const rows = sessions.data ?? [];
  const ids = rows.map((r) => r.id);

  // A call's current transcript version = its newest stats version; a call with no stats has not been analyzed yet.
  const versionOf = new Map<string, number>();
  const hitsByTracker = new Map<string, AdoptionHit[]>(trackerIds.map((t) => [t, []]));
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const [st, h] = await Promise.all([
      fetchAllPagedResult<{ session_id: string; transcript_version: number }>(
        (from, to) => db.from("session_interaction_stats").select("session_id, transcript_version").in("session_id", chunk).order("session_id").order("transcript_version").range(from, to),
        { label: "adoption stats" },
      ),
      trackerIds.length
        ? fetchAllPagedResult<{ tracker_id: string; session_id: string; transcript_version: number; id: number }>(
            (from, to) => db.from("tracker_hits").select("tracker_id, session_id, transcript_version, id").in("tracker_id", trackerIds).in("session_id", chunk).order("id").range(from, to),
            { label: "adoption hits" },
          )
        : Promise.resolve({ data: [] as Array<{ tracker_id: string; session_id: string; transcript_version: number; id: number }>, error: null }),
    ]);
    if (st.error || h.error) return null;
    for (const s of st.data ?? []) versionOf.set(s.session_id, Math.max(versionOf.get(s.session_id) ?? 0, Number(s.transcript_version)));
    for (const x of h.data ?? []) hitsByTracker.get(x.tracker_id)?.push({ sessionId: x.session_id, version: Number(x.transcript_version) });
  }
  const calls = rows
    .filter((r) => versionOf.has(r.id))
    .map((r) => ({ sessionId: r.id, repId: r.agent_id, startedAt: r.started_at, version: versionOf.get(r.id)!, channel: r.context ?? null }));
  return { sessionsInWindow: rows.length, calls, hitsByTracker };
}
