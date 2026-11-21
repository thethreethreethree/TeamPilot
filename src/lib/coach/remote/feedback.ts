/**
 * RSS Phase 4 — feedback requests, what counts as feedback, listening (Gong F16.1, F16.2, F16.4, F16.10).
 * Ported from docs/rss/scaffold/src/lib/coach/remote/feedback.ts.
 *
 * D8 (what counts as feedback / as listened) is NOT DECIDED: countsAsFeedback() and counted() throw
 * NotDecidedError, so the coaching METRICS stay hidden (the route answers 409 with the reason).
 *
 * WHERE THIS DIFFERS FROM THE SCAFFOLD, AND WHY
 *   · A request's open/closed does NOT wait for D8. It closes on `closesUnderEveryPolicy` — the events BOTH D8
 *     options count (a comment sent to the rep, a score override, a dispute answer). Whatever D8 becomes, those
 *     close a request; the only event the options disagree on (an unsent draft) never reaches the rep, so it
 *     cannot answer them. A test proves the rule implies both options, so it can never close a request that a
 *     decided D8 would call unanswered.
 *   · `managerId` may be null on a request ("my managers", 0278): then any manager's qualifying action closes it.
 *   · loadCoachingEvents reads the rows that already exist [OBSERVED]: recording_comments (0259) via
 *     pitch_scores, pitch_score_overrides (0255), dispute answer events (readDisputes.ts). Always company-pinned.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEEDBACK_POLICY, LISTENED_THRESHOLD, NotDecidedError } from "./decisions";

export type CoachingEvent =
  | { kind: "comment_sent_to_rep"; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: "comment_draft"; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: "score_override"; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: "dispute_answered"; managerId: string; repId: string; at: Date; sessionId: string }
  | { kind: "pattern_coached"; managerId: string; repId: string; at: Date }
  | { kind: "ai_score"; repId: string; at: Date; sessionId: string }
  | { kind: "own_session_action"; managerId: string; repId: string; at: Date; sessionId: string };

/** Gong's rules, adapted to our rows [OBSERVED teardown F16.2]: AI scores never count, acting on your own session
 *  never counts, drafts never reach the rep. One D8 option. */
export function gongRules(e: CoachingEvent): boolean {
  switch (e.kind) {
    case "comment_sent_to_rep":
    case "score_override":
    case "dispute_answered":
    case "pattern_coached":
      return true;
    default:
      return false;
  }
}

/** Every manager action, drafts included. The other D8 option. */
export function allManagerActions(e: CoachingEvent): boolean {
  return e.kind !== "ai_score" && e.kind !== "own_session_action";
}

/** What closes a feedback request TODAY, before D8: only what every D8 option counts, on a session. */
export function closesUnderEveryPolicy(e: CoachingEvent): boolean {
  return "sessionId" in e && gongRules(e) && allManagerActions(e);
}

export function countsAsFeedback(e: CoachingEvent): boolean {
  if (FEEDBACK_POLICY === "NOT DECIDED") throw new NotDecidedError("D8 feedback policy", "Coaching metrics stay hidden.");
  return FEEDBACK_POLICY === "GONG_RULES" ? gongRules(e) : allManagerActions(e);
}

/** A feedback request is open until a manager it was addressed to acts on that session after it. */
export function isRequestOpen(
  request: { sessionId: string; managerId: string | null; requesterId: string; createdAt: Date },
  events: CoachingEvent[],
  rule: (e: CoachingEvent) => boolean = closesUnderEveryPolicy,
): boolean {
  return !events.some(
    (e) =>
      "sessionId" in e &&
      e.sessionId === request.sessionId &&
      "managerId" in e &&
      e.managerId !== request.requesterId &&
      (request.managerId === null || e.managerId === request.managerId) &&
      e.at.getTime() >= request.createdAt.getTime() &&
      rule(e),
  );
}

/** Merge listen ranges (ms) and return the seconds actually covered — overlaps and replays count once. */
export function listenedSeconds(ranges: [number, number][]): number {
  const s = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curA = -1;
  let curB = -1;
  for (const [a, b] of s) {
    if (a > curB) {
      if (curB > curA) total += curB - curA;
      curA = a;
      curB = b;
    } else curB = Math.max(curB, b);
  }
  if (curB > curA) total += curB - curA;
  return total / 1000;
}

export function counted(ranges: [number, number][], sessionMs: number): boolean {
  if (LISTENED_THRESHOLD === "NOT DECIDED") throw new NotDecidedError("D8 listened threshold", "Listen events are still recorded.");
  const secs = listenedSeconds(ranges);
  return "minSeconds" in LISTENED_THRESHOLD
    ? secs >= LISTENED_THRESHOLD.minSeconds
    : sessionMs > 0 && (secs * 1000) / sessionMs >= LISTENED_THRESHOLD.minShareOfSession;
}

/** A listen range from the client, validated: whole ms, non-negative, forward, at most 6 h. Null = refuse. */
export function parseListenRange(fromMs: unknown, toMs: unknown): [number, number] | null {
  const a = Number(fromMs);
  const b = Number(toMs);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const from = Math.round(a);
  const to = Math.round(b);
  if (from < 0 || to <= from || to - from > 6 * 3600 * 1000) return null;
  return [from, to];
}

const ANSWER_KIND = "coach.pitch_score_answered";

/**
 * The coaching events on these sessions, from rows that already exist. Service-role reads, every one pinned to
 * `companyId`. A missing table/column degrades to fewer events (logged), never a throw.
 */
export async function loadCoachingEvents(
  admin: SupabaseClient,
  companyId: string,
  sessionIds: readonly string[],
): Promise<CoachingEvent[]> {
  if (sessionIds.length === 0) return [];
  const out: CoachingEvent[] = [];
  const { data: pitches, error: pErr } = await admin
    .from("pitch_scores")
    .select("id, session_id, rep_id")
    .eq("company_id", companyId)
    .in("session_id", [...sessionIds]);
  if (pErr) {
    console.error(`[feedback] pitch read failed: ${pErr.message}`);
    return out;
  }
  const bySession = new Map<string, { sessionId: string; repId: string }>();
  for (const p of (pitches ?? []) as Array<{ id: string; session_id: string | null; rep_id: string }>) {
    if (p.session_id) bySession.set(String(p.id), { sessionId: String(p.session_id), repId: String(p.rep_id) });
  }
  const pitchIds = [...bySession.keys()];
  if (pitchIds.length === 0) return out;

  const { data: comments, error: cErr } = await admin
    .from("recording_comments")
    .select("pitch_id, author_id, sent_to_rep, created_at")
    .eq("company_id", companyId)
    .in("pitch_id", pitchIds);
  if (cErr) console.error(`[feedback] comment read failed: ${cErr.message}`);
  for (const c of (comments ?? []) as Array<{ pitch_id: string; author_id: string; sent_to_rep: boolean; created_at: string }>) {
    const p = bySession.get(String(c.pitch_id));
    if (!p) continue;
    const base = { managerId: String(c.author_id), repId: p.repId, at: new Date(c.created_at), sessionId: p.sessionId };
    out.push(
      base.managerId === p.repId
        ? { kind: "own_session_action", ...base }
        : { kind: c.sent_to_rep ? "comment_sent_to_rep" : "comment_draft", ...base },
    );
  }

  const { data: overrides, error: oErr } = await admin
    .from("pitch_score_overrides")
    .select("pitch_id, actor_id, created_at")
    .eq("company_id", companyId)
    .in("pitch_id", pitchIds);
  if (oErr) console.error(`[feedback] override read failed: ${oErr.message}`);
  for (const o of (overrides ?? []) as Array<{ pitch_id: string; actor_id: string; created_at: string }>) {
    const p = bySession.get(String(o.pitch_id));
    if (!p) continue;
    const base = { managerId: String(o.actor_id), repId: p.repId, at: new Date(o.created_at), sessionId: p.sessionId };
    out.push(base.managerId === p.repId ? { kind: "own_session_action", ...base } : { kind: "score_override", ...base });
  }

  const { data: answers, error: aErr } = await admin
    .from("events")
    .select("actor, subject, created_at")
    .eq("company_id", companyId)
    .eq("kind", ANSWER_KIND)
    .in("subject", pitchIds.map((id) => `pitch:${id}`));
  if (aErr) console.error(`[feedback] answer read failed: ${aErr.message}`);
  for (const a of (answers ?? []) as Array<{ actor: string | null; subject: string; created_at: string }>) {
    const p = bySession.get(String(a.subject).replace(/^pitch:/, ""));
    if (!p || !a.actor) continue;
    const base = { managerId: String(a.actor), repId: p.repId, at: new Date(a.created_at), sessionId: p.sessionId };
    out.push(base.managerId === p.repId ? { kind: "own_session_action", ...base } : { kind: "dispute_answered", ...base });
  }
  return out;
}
