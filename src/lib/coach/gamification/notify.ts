import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "./rubric";
import { managerChain, type Person } from "@/lib/coach/remote/access";

/**
 * Gamification Phase 4 — manager notifications (in-app only). Exactly two triggers: a strong session (points at/above
 * the alert line) and a closed deal. Recipient resolution follows FINDINGS: there is NO per-agent manager FK, so a
 * "manager" is any company admin (role in CEO/COO/admin) OR sales_coach_role='admin' of the agent's company — the
 * alert fans out to all of them. Idempotent via the Phase-1 unique index (recipient_id, type, session_id): a
 * re-score / retry / double-fire notifies at most once. Best-effort + service-role; never throws into the caller.
 */

/**
 * The alert's recipients.
 *
 * RSS Phase 0 step 8 (migration 0273): once a company is on the reporting tree — every active rep has a
 * manager, `rss_tree_active` — an alert goes up the rep's manager chain only (`managerChain`, nearest first),
 * not to every manager in the company. Before that, and whenever the tree check cannot be answered (0273 not
 * applied, a read error), it is today's fan-out to every company admin and sales-coach admin. Falling back to
 * today's rule is the safe direction: nobody stops being told about a rep they were told about yesterday.
 *
 * The tree decision is the database's verdict (the same function the RLS policies use), not a second copy.
 */
async function resolveManagers(companyId: string, excludeAgentId: string): Promise<string[]> {
  const admin = createAdminClient();

  // Ask the tree question FIRST, and read manager_id only when the answer is yes: before 0272/0273 exist the
  // column and the function are missing, and a select naming manager_id would fail the whole read and
  // silently notify nobody.
  let treeActive = false;
  try {
    const { data, error } = await admin.rpc("rss_tree_active", { company: companyId });
    treeActive = !error && data === true;
  } catch {
    treeActive = false; // can't tell → today's fan-out
  }
  if (treeActive) {
    const { data: lines, error: linesErr } = await admin
      .from("profiles")
      .select("id, manager_id")
      .eq("company_id", companyId);
    if (!linesErr && lines) {
      try {
        const people: Person[] = (lines as Array<{ id: string; manager_id: string | null }>).map((p) => ({
          id: String(p.id),
          companyId,
          managerId: p.manager_id ?? null,
          isCompanyAdmin: false, // not used by managerChain
          isSalesCoachManager: false,
        }));
        return managerChain(excludeAgentId, people).filter((id) => id !== excludeAgentId);
      } catch (err) {
        // A loop the database trigger should have refused: fall back to today's fan-out rather than drop the alert.
        // eslint-disable-next-line no-console
        console.error(`[gamification-notify] manager chain unusable for ${excludeAgentId}; notifying all managers:`, err);
      }
    }
  }

  const { data } = await admin
    .from("profiles")
    .select("id, role, sales_coach_role")
    .eq("company_id", companyId);
  return (data ?? [])
    .filter((p) => ["CEO", "COO", "admin"].includes(String(p.role)) || p.sales_coach_role === "admin")
    .map((p) => String(p.id))
    .filter((id) => id !== excludeAgentId); // don't notify a manager about their own session
}

async function insertForManagers(args: {
  companyId: string;
  agentId: string;
  sessionId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}): Promise<number> {
  const recipients = await resolveManagers(args.companyId, args.agentId);
  if (recipients.length === 0) return 0;
  const admin = createAdminClient();
  // Resolve the agent's name once so the notification renders without a join at read time (plan 4). Best-effort.
  if (args.payload.agent_name == null) {
    const { data: prof } = await admin.from("profiles").select("full_name").eq("id", args.agentId).maybeSingle();
    args.payload = { ...args.payload, agent_name: (prof?.full_name as string | null) ?? null };
  }
  const rows = recipients.map((recipient_id) => ({
    company_id: args.companyId,
    recipient_id,
    agent_id: args.agentId,
    session_id: args.sessionId,
    type: args.type,
    payload: args.payload,
  }));
  // upsert with ignore-on-conflict so the unique index makes a re-fire a no-op (idempotent), not an error.
  const { error } = await admin
    .from("manager_notifications")
    .upsert(rows, { onConflict: "recipient_id,type,session_id", ignoreDuplicates: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.error(`[gamification-notify] ${args.type} insert failed for session ${args.sessionId}:`, error.message);
    return 0;
  }
  return recipients.length;
}

/** Fire a strong-session alert to the agent's managers. Best-effort (caught) — never breaks the caller's flow. */
export async function notifyStrongSession(args: {
  companyId: string;
  agentId: string;
  agentName?: string | null;
  sessionId: string;
  points: number;
  band: string;
}): Promise<void> {
  try {
    await insertForManagers({
      companyId: args.companyId,
      agentId: args.agentId,
      sessionId: args.sessionId,
      type: "strong_session",
      payload: { agent_name: args.agentName ?? null, total: args.points, band: args.band },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notify] notifyStrongSession threw:", e instanceof Error ? e.message : e);
  }
}

/** Fire a deal-closed alert to the agent's managers. Best-effort (caught). */
export async function notifyDealClosed(args: {
  companyId: string;
  agentId: string;
  agentName?: string | null;
  sessionId: string;
  dealValue?: number | null;
}): Promise<void> {
  try {
    await insertForManagers({
      companyId: args.companyId,
      agentId: args.agentId,
      sessionId: args.sessionId,
      type: "deal_closed",
      payload: { agent_name: args.agentName ?? null, deal_value: args.dealValue ?? null },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notify] notifyDealClosed threw:", e instanceof Error ? e.message : e);
  }
}

/**
 * RSS Phase 4 (0279): a rep asked for feedback on a call. To the named manager when the rep has one, else to the
 * same managers every other rep alert reaches (resolveManagers — one fan-out rule, not a second). Upsert-UPDATE on
 * (recipient_id, type, session_id): asking again on the same call brings the one alert back to the top and to
 * unread, rather than stacking bells. Best-effort: the request is already stored; returns how many were told.
 */
export async function notifyFeedbackRequested(args: {
  companyId: string;
  repId: string;
  repName: string | null;
  sessionId: string;
  recipientId: string | null;
  message: string | null;
}): Promise<number> {
  try {
    const recipients = args.recipientId
      ? [args.recipientId]
      : await resolveManagers(args.companyId, args.repId);
    if (recipients.length === 0) return 0;
    const now = new Date().toISOString();
    const { error } = await createAdminClient()
      .from("manager_notifications")
      .upsert(
        recipients.map((recipient_id) => ({
          company_id: args.companyId,
          recipient_id,
          agent_id: args.repId,
          session_id: args.sessionId,
          type: "feedback_requested",
          payload: { agent_name: args.repName, excerpt: args.message ? args.message.slice(0, 160) : null },
          created_at: now,
          read_at: null,
        })),
        { onConflict: "recipient_id,type,session_id" },
      );
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[gamification-notify] feedback_requested failed session=${args.sessionId}: ${error.message}`);
      return 0;
    }
    return recipients.length;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notify] notifyFeedbackRequested threw:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/**
 * RSS Phase 7 (0283): a rep completed a scored attempt at an assigned scenario → the manager who assigned it.
 * session_id is null (practice is not a call), so each attempt is its own alert. Best-effort.
 */
export async function notifyTrainingAttempted(args: {
  companyId: string;
  repId: string;
  managerId: string;
  scenarioTitle: string;
  score: number;
  passed: boolean | null;
}): Promise<boolean> {
  try {
    if (args.managerId === args.repId) return false;
    const admin = createAdminClient();
    const { data: prof } = await admin.from("profiles").select("full_name").eq("company_id", args.companyId).eq("id", args.repId).maybeSingle();
    const { error } = await admin.from("manager_notifications").insert({
      company_id: args.companyId,
      recipient_id: args.managerId,
      agent_id: args.repId,
      session_id: null,
      type: "training_attempted",
      payload: { agent_name: (prof?.full_name as string | null) ?? null, scenario_title: args.scenarioTitle, total: args.score, passed: args.passed },
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[gamification-notify] training_attempted failed rep=${args.repId}: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notify] notifyTrainingAttempted threw:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * RSS Phase 1 follow-up (0289): an UPLOADED phone/video call has finished processing — tell the rep who took it.
 * "Uploaded" is the existing marker: audio_duration_seconds is stamped only by upload-recording (NULL for live calls,
 * where the rep is on the page anyway). Once per call: the dedupe index makes a re-read (trim, relabel) a 23505, which
 * is the intended no-op. Never throws.
 */
export async function notifyCallReady(args: { companyId: string; sessionId: string }): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data: s } = await admin
      .from("coaching_sessions")
      .select("agent_id, context, client_label, audio_duration_seconds")
      .eq("company_id", args.companyId)
      .eq("id", args.sessionId)
      .maybeSingle();
    if (!s || s.audio_duration_seconds == null || !["phone", "video"].includes(String(s.context))) return false;
    const { error } = await admin.from("manager_notifications").insert({
      company_id: args.companyId,
      recipient_id: s.agent_id,
      agent_id: s.agent_id,
      session_id: args.sessionId,
      type: "call_ready",
      payload: { client_label: (s.client_label as string | null) ?? null },
    });
    if (error && error.code !== "23505") {
      // eslint-disable-next-line no-console
      console.error(`[gamification-notify] call_ready failed session=${args.sessionId}: ${error.message}`);
      return false;
    }
    return !error;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notify] notifyCallReady threw:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Gong F15.21 (0305): a rep disputed a score → the rep's managers (resolveManagers — the one fan-out rule). Upserted on
 * (recipient_id, type, session_id): a second dispute on the same call brings the one alert back to the top. The
 * payload carries the call's channel so the bell sends the manager to the right module's queue (Remote Sales →
 * Coaching for a phone/video call, Coach Assessment for a door pitch). Best-effort; the dispute is already stored.
 */
export async function notifyScoreDisputed(args: {
  companyId: string;
  repId: string;
  sessionId: string | null;
  pitchId: string;
  note: string;
  channel: string | null;
  /** Who filed it — a manager filing on a rep's behalf is not told about their own dispute. */
  actorId?: string;
}): Promise<number> {
  try {
    const recipients = (await resolveManagers(args.companyId, args.repId)).filter((id) => id !== args.actorId);
    if (recipients.length === 0) return 0;
    const admin = createAdminClient();
    const { data: prof } = await admin.from("profiles").select("full_name").eq("company_id", args.companyId).eq("id", args.repId).maybeSingle();
    const now = new Date().toISOString();
    const { error } = await admin.from("manager_notifications").upsert(
      recipients.map((recipient_id) => ({
        company_id: args.companyId,
        recipient_id,
        agent_id: args.repId,
        session_id: args.sessionId,
        type: "score_disputed",
        payload: { agent_name: (prof?.full_name as string | null) ?? null, pitch_id: args.pitchId, excerpt: args.note.slice(0, 160), channel: args.channel },
        created_at: now,
        read_at: null,
      })),
      { onConflict: "recipient_id,type,session_id" },
    );
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[gamification-notify] score_disputed failed pitch=${args.pitchId}: ${error.message}`);
      return 0;
    }
    return recipients.length;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notify] notifyScoreDisputed threw:", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Gong F15.21 (0305): a manager answered a rep's dispute → that rep. Upserted like the dispute. Best-effort. */
export async function notifyDisputeAnswered(args: {
  companyId: string;
  repId: string;
  managerId: string;
  sessionId: string | null;
  pitchId: string;
  note: string;
}): Promise<boolean> {
  try {
    if (args.repId === args.managerId) return false;
    const { error } = await createAdminClient().from("manager_notifications").upsert(
      [
        {
          company_id: args.companyId,
          recipient_id: args.repId,
          agent_id: args.repId,
          session_id: args.sessionId,
          type: "dispute_answered",
          payload: { pitch_id: args.pitchId, excerpt: args.note.slice(0, 160) },
          created_at: new Date().toISOString(),
          read_at: null,
        },
      ],
      { onConflict: "recipient_id,type,session_id" },
    );
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[gamification-notify] dispute_answered failed pitch=${args.pitchId}: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[gamification-notify] notifyDisputeAnswered threw:", e instanceof Error ? e.message : e);
    return false;
  }
}
