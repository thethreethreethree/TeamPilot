import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "./rubric";

/**
 * Gamification Phase 4 — manager notifications (in-app only). Exactly two triggers: a strong session (points at/above
 * the alert line) and a closed deal. Recipient resolution follows FINDINGS: there is NO per-agent manager FK, so a
 * "manager" is any company admin (role in CEO/COO/admin) OR sales_coach_role='admin' of the agent's company — the
 * alert fans out to all of them. Idempotent via the Phase-1 unique index (recipient_id, type, session_id): a
 * re-score / retry / double-fire notifies at most once. Best-effort + service-role; never throws into the caller.
 */

/** The company's managers (notification recipients) — company admins + sales-coach admins, minus the agent themself. */
async function resolveManagers(companyId: string, excludeAgentId: string): Promise<string[]> {
  const admin = createAdminClient();
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
