import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { isRemoteContext } from "@/lib/coach/sessionContext";
import { loadLines } from "../followThrough";
import type { CallLines } from "./playbook";

/**
 * A deal's latest phone/video sales calls with their current transcripts, for the AI reads over a whole deal (the
 * reviewer, the brief). Read through the CALLER's client — calls' and transcripts' RLS, the tree and hidden calls apply,
 * so an AI read only ever sees what this person may open. Newest first; at most `maxCalls`; the line budget is shared.
 * "failed" on any failed read (never a shorter deal passed off as the whole one).
 */
export const DEAL_CALLS = 5;
export const DEAL_LINES = 900;

export async function loadDealCalls(
  db: SupabaseClient,
  prospectId: string,
  opts: { maxCalls?: number; maxLines?: number } = {},
): Promise<{ calls: Array<CallLines & { version: number }>; linked: number } | "failed"> {
  const maxCalls = opts.maxCalls ?? DEAL_CALLS;
  const maxLines = opts.maxLines ?? DEAL_LINES;
  const { data: links, error: lErr } = await db.from("remote_prospect_calls").select("session_id").eq("prospect_id", prospectId).order("id").limit(200);
  if (lErr) return "failed";
  const ids = ((links ?? []) as Array<{ session_id: string }>).map((l) => l.session_id);
  if (!ids.length) return { calls: [], linked: 0 };
  const { data: sess, error: sErr } = await db.from("coaching_sessions").select("id, started_at, audio_started_at, context, session_kind").in("id", ids).order("started_at", { ascending: false });
  if (sErr) return "failed";
  const usable = ((sess ?? []) as Array<{ id: string; started_at: string; audio_started_at: string | null; context: string | null; session_kind: string | null }>)
    .filter((s) => isRemoteContext(s.context) && isSalesCall(s.session_kind ?? "sales"))
    .slice(0, maxCalls);
  const perCall = Math.max(60, Math.floor(maxLines / Math.max(1, usable.length)));
  const calls: Array<CallLines & { version: number }> = [];
  for (const s of usable) {
    const loaded = await loadLines(db, s.id, audioBaseIso(s.started_at, s.audio_started_at) ?? s.started_at);
    if (loaded === null) return "failed";
    if (loaded.lines.length) calls.push({ sessionId: s.id, startedAt: s.started_at, version: loaded.version, lines: loaded.lines.slice(0, perCall) });
  }
  return { calls, linked: ids.length };
}
