import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/care/email/outbound";
import { STRONG_SESSION_THRESHOLD } from "./bands";
import { isAdminRole } from "@/lib/roles";

/**
 * Weekly manager digest (founder 2026-09-04) — a once-a-week email to each manager summarizing their team's last
 * 7 days: total points, strong sessions, deals, and the top performers. The COMPANION to the live NotificationBell
 * alerts (instant pings for events; this is the weekly rollup). Sent by the weekly-digest cron; content is a PURE
 * summary + a PURE template (unit-tested), so the orchestrator only does I/O.
 *
 * Reuses the same source of truth the board reads (the ledger + sold sessions), so the numbers agree; the strong
 * threshold + admin-role predicate come from the shared modules (no re-derivation).
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeekLedgerRow {
  agent_id: string;
  agent_name: string | null;
  points: number;
}
export interface TeamWeekSummary {
  activeReps: number;
  teamPoints: number;
  teamStrong: number;
  teamDeals: number;
  top: { agentId: string; name: string; points: number; sessions: number; strong: number; deals: number }[];
}

/** Pure: fold a week of ledger rows (+ this week's sold sessions) into the per-team summary the email renders. */
export function summarizeTeamWeek(
  rows: ReadonlyArray<WeekLedgerRow>,
  soldAgentIds: ReadonlyArray<string>,
  topN = 5,
): TeamWeekSummary {
  const byAgent = new Map<string, { name: string; points: number; sessions: number; strong: number; deals: number }>();
  const get = (id: string, name: string | null) => {
    let a = byAgent.get(id);
    if (!a) {
      a = { name: name || "A rep", points: 0, sessions: 0, strong: 0, deals: 0 };
      byAgent.set(id, a);
    } else if (name && a.name === "A rep") a.name = name;
    return a;
  };
  for (const r of rows) {
    const a = get(r.agent_id, r.agent_name);
    a.points += r.points;
    a.sessions += 1;
    if (r.points >= STRONG_SESSION_THRESHOLD) a.strong += 1;
  }
  let teamDeals = 0;
  for (const id of soldAgentIds) {
    // a deal counts toward the team even if that rep ran no scored pitch this week
    get(id, null).deals += 1;
    teamDeals += 1;
  }
  const all = [...byAgent.entries()].map(([agentId, a]) => ({ agentId, ...a }));
  const top = [...all].sort((x, y) => y.points - x.points || y.strong - x.strong).slice(0, topN);
  return {
    activeReps: all.filter((a) => a.sessions > 0 || a.deals > 0).length,
    teamPoints: all.reduce((s, a) => s + a.points, 0),
    teamStrong: all.reduce((s, a) => s + a.strong, 0),
    teamDeals,
    top,
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Pure: render the manager digest (subject + HTML + text). Inline styles + a light palette so it reads in any client. */
export function renderManagerDigestEmail(
  summary: TeamWeekSummary,
  opts: { companyName: string; weekLabel: string; boardUrl: string; managerName?: string | null },
): { subject: string; htmlBody: string; textBody: string } {
  const { companyName, weekLabel, boardUrl } = opts;
  const subject = `${companyName} — your team this week (${weekLabel})`;
  const medal = ["🥇", "🥈", "🥉"];
  const rowsHtml = summary.top
    .map((a, i) => {
      const rank = i < 3 ? medal[i] : `${i + 1}.`;
      const bits = [`${a.points} pts`, `${a.strong} strong`, a.deals ? `${a.deals} deal${a.deals === 1 ? "" : "s"}` : null]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font:600 15px/1.4 -apple-system,Segoe UI,sans-serif;color:#111">${rank}&nbsp;${esc(a.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font:400 13px/1.4 -apple-system,Segoe UI,sans-serif;color:#666">${bits}</td>
      </tr>`;
    })
    .join("");
  const stat = (n: number | string, label: string) =>
    `<td style="text-align:center;padding:12px 8px"><div style="font:800 26px/1 -apple-system,Segoe UI,sans-serif;color:#e8563a">${n}</div><div style="font:600 11px/1.4 -apple-system,Segoe UI,sans-serif;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-top:4px">${label}</div></td>`;

  const htmlBody = `<!doctype html><html><body style="margin:0;background:#f5f5f7;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e6ea">
    <tr><td style="background:#141418;padding:22px 28px">
      <div style="font:700 12px/1 -apple-system,Segoe UI,sans-serif;color:#ff7a55;letter-spacing:.18em;text-transform:uppercase">ELOSTATE · Sales Coach</div>
      <div style="font:800 22px/1.2 -apple-system,Segoe UI,sans-serif;color:#fff;margin-top:8px">Your team this week</div>
      <div style="font:400 13px/1.4 -apple-system,Segoe UI,sans-serif;color:#a6abb5;margin-top:4px">${esc(companyName)} · ${esc(weekLabel)}</div>
    </td></tr>
    <tr><td style="padding:8px 20px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${stat(summary.teamPoints.toLocaleString(), "Points")}
        ${stat(summary.teamStrong, "Strong sessions")}
        ${stat(summary.teamDeals, "Deals")}
      </tr></table>
    </td></tr>
    <tr><td style="padding:8px 28px 4px">
      <div style="font:700 12px/1 -apple-system,Segoe UI,sans-serif;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Top performers</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml || `<tr><td style="padding:10px 0;font:400 14px -apple-system,Segoe UI,sans-serif;color:#888">No scored pitches this week.</td></tr>`}</table>
    </td></tr>
    <tr><td style="padding:20px 28px 28px">
      <a href="${esc(boardUrl)}" style="display:inline-block;background:#e8563a;color:#fff;text-decoration:none;font:600 14px -apple-system,Segoe UI,sans-serif;padding:11px 20px;border-radius:9px">Open the Scoreboard →</a>
      <div style="font:400 12px/1.5 -apple-system,Segoe UI,sans-serif;color:#aaa;margin-top:18px">${summary.activeReps} rep${summary.activeReps === 1 ? "" : "s"} active this week. You're getting this because you manage a Sales Coach team.</div>
    </td></tr>
  </table>
  </td></tr></table></body></html>`;

  const textLines = [
    `${companyName} — your team this week (${weekLabel})`,
    ``,
    `Points: ${summary.teamPoints}   Strong sessions: ${summary.teamStrong}   Deals: ${summary.teamDeals}`,
    ``,
    `Top performers:`,
    ...summary.top.map((a, i) => `  ${i + 1}. ${a.name} — ${a.points} pts, ${a.strong} strong${a.deals ? `, ${a.deals} deal(s)` : ""}`),
    summary.top.length ? `` : `  (no scored pitches this week)`,
    ``,
    `Open the Scoreboard: ${boardUrl}`,
    `${summary.activeReps} rep(s) active this week.`,
  ];
  return { subject, htmlBody, textBody: textLines.join("\n") };
}

const ADMIN_ROLE_PREDICATE = (role: string | null, salesRole: string | null) =>
  isAdminRole(role) || salesRole === "admin";

export interface DigestRunResult {
  companies: number;
  managersEmailed: number;
  skippedNoActivity: number;
  skippedNoEmail: number;
  sendFailures: number;
  emailConfigured: boolean;
}

/**
 * Orchestrate the weekly manager digest: for each company with activity in the last 7 days, summarize the team and
 * email every manager. Service-role; injectable `send`/`now` for tests. Best-effort per manager (a send failure is
 * counted, never fatal for the rest).
 */
export async function runWeeklyManagerDigest(deps?: {
  admin?: SupabaseClient;
  send?: typeof sendTransactionalEmail;
  now?: number;
  appBaseUrl?: string;
}): Promise<DigestRunResult> {
  const admin = deps?.admin ?? createAdminClient();
  const send = deps?.send ?? sendTransactionalEmail;
  const now = deps?.now ?? Date.now();
  const sinceIso = new Date(now - WEEK_MS).toISOString();
  // Server-only: a plain (non-NEXT_PUBLIC_) override, defaulting to prod — never bundled into the client.
  const base = deps?.appBaseUrl ?? process.env.APP_BASE_URL ?? "https://elostate.com";
  const boardUrl = `${base.replace(/\/$/, "")}/dashboard/sales-coach/scoreboard`;
  const weekLabel = new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const result: DigestRunResult = {
    companies: 0,
    managersEmailed: 0,
    skippedNoActivity: 0,
    skippedNoEmail: 0,
    sendFailures: 0,
    emailConfigured: Boolean(process.env.POSTMARK_SERVER_TOKEN && process.env.CARE_EMAIL_HOST_DOMAIN),
  };

  // Companies with points activity this week.
  const { data: weekRows } = await admin
    .from("agent_point_ledger")
    .select("company_id, agent_id, points, created_at")
    .eq("reason", "session_score")
    .gte("created_at", sinceIso);
  const byCompany = new Map<string, { agent_id: string; points: number }[]>();
  for (const r of weekRows ?? []) {
    const cid = String((r as { company_id: string }).company_id);
    if (!byCompany.has(cid)) byCompany.set(cid, []);
    byCompany.get(cid)!.push({ agent_id: String((r as { agent_id: string }).agent_id), points: Number((r as { points: number }).points) });
  }

  for (const [companyId, rows] of byCompany) {
    result.companies += 1;
    // Names for the agents in this week's rows.
    const agentIds = [...new Set(rows.map((r) => r.agent_id))];
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", agentIds);
    const nameById = new Map((profs ?? []).map((p) => [String((p as { id: string }).id), (p as { full_name: string | null }).full_name]));
    // This week's sold sessions (deals) for the company.
    const { data: sold } = await admin
      .from("coaching_sessions")
      .select("agent_id")
      .eq("company_id", companyId)
      .eq("outcome", "sold")
      .gte("created_at", sinceIso);
    const summary = summarizeTeamWeek(
      rows.map((r) => ({ agent_id: r.agent_id, agent_name: nameById.get(r.agent_id) ?? null, points: r.points })),
      (sold ?? []).map((s) => String((s as { agent_id: string }).agent_id)),
    );
    if (summary.activeReps === 0) {
      result.skippedNoActivity += 1;
      continue;
    }
    // Company name + managers.
    const { data: company } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
    const companyName = (company as { name?: string } | null)?.name ?? "Your team";
    const { data: managers } = await admin
      .from("profiles")
      .select("id, full_name, role, sales_coach_role")
      .eq("company_id", companyId);
    const mgrs = (managers ?? []).filter((m) =>
      ADMIN_ROLE_PREDICATE((m as { role: string | null }).role, (m as { sales_coach_role: string | null }).sales_coach_role),
    );
    const email = renderManagerDigestEmail(summary, { companyName, weekLabel, boardUrl });
    for (const m of mgrs) {
      const id = String((m as { id: string }).id);
      const { data: userRes } = await admin.auth.admin.getUserById(id);
      const to = userRes?.user?.email;
      if (!to) {
        result.skippedNoEmail += 1;
        continue;
      }
      const sent = await send({ to, subject: email.subject, htmlBody: email.htmlBody, textBody: email.textBody, fromName: "ELOSTATE Sales Coach" });
      if (sent.ok) result.managersEmailed += 1;
      else result.sendFailures += 1;
    }
  }
  return result;
}
