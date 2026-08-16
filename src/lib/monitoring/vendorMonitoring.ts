import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Vendor founder-monitoring data layer (0214 exemption, founder-directed 2026-08-16).
 *
 * A SANCTIONED, contained cross-tenant capability: the two vendor founders may monitor
 * sessions across the companies that ALREADY existed when 0214 applied. Every function
 * here is service-role (bypasses RLS) and is ONLY reachable behind requireVendorAdmin at
 * the route layer — never from a customer client. Two rails make the exemption safe:
 *
 *   1. ALLOWLIST — every cross-tenant read is gated by `isCompanyMonitorable(companyId)`
 *      (membership in `vendor_monitoring_scope`, seeded from EXISTING companies only). A
 *      company not on the list is invisible here, so a newly-onboarded customer is NOT
 *      monitorable until a founder deliberately adds it.
 *   2. AUDIT — callers record every access via `logMonitoringAccess`, so the capability
 *      is accountable.
 *
 * This layer READS ONLY. Monitoring never mutates a customer's session.
 */

export type MonitorableCompany = { id: string; name: string; addedAt: string };

export type MonitoredSession = {
  id: string;
  agentId: string;
  agentName: string;
  clientLabel: string | null;
  context: string | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  outcome: string | null;
};

export type MonitoredSegment = { speaker: string; text: string; seq: number };

export type MonitoredSessionDetail = {
  company_id: string;
  session: MonitoredSession;
  segments: MonitoredSegment[];
};

/** True iff `companyId` is on the founder-monitoring allowlist. The single gate every
 *  cross-tenant read in this module funnels through. */
export async function isCompanyMonitorable(companyId: string): Promise<boolean> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("vendor_monitoring_scope")
    .select("company_id")
    .eq("company_id", companyId)
    .maybeSingle();
  return Boolean(data);
}

/** The companies a founder may monitor (allowlist ⋈ company name), name-sorted. */
export async function listMonitorableCompanies(): Promise<MonitorableCompany[]> {
  const sb = createAdminClient();
  const { data: scope } = await sb
    .from("vendor_monitoring_scope")
    .select("company_id, added_at");
  if (!scope?.length) return [];
  const ids = scope.map((s) => s.company_id as string);
  const { data: comps } = await sb.from("companies").select("id, name").in("id", ids);
  const nameById = new Map((comps ?? []).map((c) => [c.id as string, c.name as string]));
  return scope
    .map((s) => ({
      id: s.company_id as string,
      name: nameById.get(s.company_id as string) ?? "Unknown company",
      addedAt: s.added_at as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function agentNameMap(
  profs: Array<{ id: string; full_name: string | null }> | null
): Map<string, string> {
  return new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "Unnamed"]));
}

/** List a monitorable company's sessions (newest first). Returns [] if the company is
 *  NOT on the allowlist — the caller must still gate, but this fails safe either way. */
export async function listCompanySessions(
  companyId: string,
  limit = 200
): Promise<MonitoredSession[]> {
  if (!(await isCompanyMonitorable(companyId))) return [];
  const sb = createAdminClient();
  const { data } = await sb
    .from("coaching_sessions")
    .select(
      "id, agent_id, client_label, context, status, started_at, ended_at, outcome"
    )
    .eq("company_id", companyId)
    .order("started_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const agentIds = [...new Set(rows.map((r) => r.agent_id as string))];
  const { data: profs } = agentIds.length
    ? await sb.from("profiles").select("id, full_name").in("id", agentIds)
    : { data: [] };
  const nameById = agentNameMap(profs as Array<{ id: string; full_name: string | null }>);
  return rows.map((r) => ({
    id: r.id as string,
    agentId: r.agent_id as string,
    agentName: nameById.get(r.agent_id as string) ?? "Unnamed",
    clientLabel: (r.client_label as string | null) ?? null,
    context: (r.context as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    startedAt: (r.started_at as string | null) ?? null,
    endedAt: (r.ended_at as string | null) ?? null,
    outcome: (r.outcome as string | null) ?? null,
  }));
}

/** One session's detail + transcript, ONLY if its company is monitorable. Returns null
 *  when the session doesn't exist OR its company is not on the allowlist (indistinguishable
 *  to the caller — no cross-tenant existence leak beyond the allowlist). */
export async function getMonitoredSession(
  sessionId: string
): Promise<MonitoredSessionDetail | null> {
  const sb = createAdminClient();
  const { data: session } = await sb
    .from("coaching_sessions")
    .select(
      "id, company_id, agent_id, client_label, context, status, started_at, ended_at, outcome"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;
  const companyId = session.company_id as string;
  if (!(await isCompanyMonitorable(companyId))) return null;

  const [{ data: segs }, { data: profs }] = await Promise.all([
    sb
      .from("coaching_transcript_segments")
      .select("speaker, text, seq")
      .eq("session_id", sessionId)
      .order("seq", { ascending: true }),
    sb.from("profiles").select("id, full_name").eq("id", session.agent_id as string),
  ]);
  const nameById = agentNameMap(profs as Array<{ id: string; full_name: string | null }>);
  return {
    company_id: companyId,
    session: {
      id: session.id as string,
      agentId: session.agent_id as string,
      agentName: nameById.get(session.agent_id as string) ?? "Unnamed",
      clientLabel: (session.client_label as string | null) ?? null,
      context: (session.context as string | null) ?? null,
      status: (session.status as string | null) ?? null,
      startedAt: (session.started_at as string | null) ?? null,
      endedAt: (session.ended_at as string | null) ?? null,
      outcome: (session.outcome as string | null) ?? null,
    },
    segments: (segs ?? []).map((s) => ({
      speaker: (s.speaker as string) ?? "unknown",
      text: (s.text as string) ?? "",
      seq: (s.seq as number) ?? 0,
    })),
  };
}

/** Append the audit row for a monitoring read. Returns whether the audit landed.
 *
 *  The audit trail IS the accountability mechanism for this sanctioned cross-tenant exemption, so a
 *  failure must be OBSERVABLE, never silently swallowed (audit 2026-08-16). It is logged here; the
 *  session-detail route additionally treats a failed audit as fail-loud (it does NOT serve the
 *  transcript when the read could not be recorded) — an unrecorded cross-tenant read is worse than a
 *  transient 503 the founder can retry. The list endpoints log-and-continue (navigation metadata). */
export async function logMonitoringAccess(entry: {
  actor: string;
  companyId?: string | null;
  sessionId?: string | null;
  resource: string;
}): Promise<boolean> {
  try {
    const sb = createAdminClient();
    const { error } = await sb.from("vendor_monitoring_access_log").insert({
      actor: entry.actor,
      company_id: entry.companyId ?? null,
      session_id: entry.sessionId ?? null,
      resource: entry.resource,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(
        `[monitoring] audit-log write failed for ${entry.resource} (actor ${entry.actor}): ${error.message}`
      );
      return false;
    }
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[monitoring] audit-log write threw for ${entry.resource} (actor ${entry.actor}):`,
      e instanceof Error ? e.message : e
    );
    return false;
  }
}
