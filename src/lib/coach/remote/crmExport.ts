import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What a "Send to CRM" delivers (0330; General Sales Interface PDF; founder picker "Company webhook"). Assembled at SEND
 * time from the records, company-pinned, so the webhook queue holds only the call's id and a call erased before sending
 * sends only what is left. Missing parts are null, never invented.
 */
export type CrmCall = {
  call: { id: string; startedAt: string | null; channel: string | null; client: string | null; rep: string | null; outcome: string | null; url: string };
  brief: { summary: string | null; keyPoints: string[]; nextSteps: string[] };
  followUp: { email: { subject: string | null; body: string } | null; text: { body: string } | null };
  prospect: { name: string | null; organization: string | null; stage: string | null; status: string | null; amount: number | null; nextCallDate: string | null } | null;
};

const texts = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : x && typeof x === "object" && typeof (x as { text?: unknown }).text === "string" ? (x as { text: string }).text : "")).filter(Boolean) : [];

export async function buildCrmCall(admin: SupabaseClient, companyId: string, sessionId: string, origin: string): Promise<CrmCall | null> {
  const { data: s } = await admin.from("coaching_sessions").select("id, agent_id, started_at, context, client_label, outcome").eq("company_id", companyId).eq("id", sessionId).maybeSingle();
  if (!s) return null;
  const [rep, summary, brief, drafts, link] = await Promise.all([
    admin.from("profiles").select("full_name").eq("company_id", companyId).eq("id", s.agent_id).maybeSingle(),
    admin.from("events").select("payload").eq("company_id", companyId).eq("kind", "coach.session_summary_generated").eq("subject", `sales_session:${sessionId}`).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("remote_call_briefs").select("key_points, next_steps").eq("company_id", companyId).eq("session_id", sessionId).order("transcript_version", { ascending: false }).limit(1).maybeSingle(),
    admin.from("remote_followup_drafts").select("channel, subject, body, created_at").eq("company_id", companyId).eq("session_id", sessionId).order("created_at", { ascending: false }).limit(20),
    admin.from("remote_prospect_calls").select("prospect_id").eq("company_id", companyId).eq("session_id", sessionId).maybeSingle(),
  ]);
  const d = (drafts.data ?? []) as Array<{ channel: string; subject: string | null; body: string }>;
  const email = d.find((x) => x.channel === "email");
  const text = d.find((x) => x.channel === "text");
  let prospect: CrmCall["prospect"] = null;
  if (link.data?.prospect_id) {
    const { data: p } = await admin.from("remote_prospects_current").select("name, organization, stage_label, status, amount, next_call_date").eq("company_id", companyId).eq("id", link.data.prospect_id).maybeSingle();
    if (p) prospect = { name: p.name, organization: p.organization, stage: p.stage_label, status: p.status, amount: p.amount === null ? null : Number(p.amount), nextCallDate: p.next_call_date };
  }
  const sum = (summary.data?.payload as { summary?: unknown } | null)?.summary;
  return {
    call: { id: String(s.id), startedAt: s.started_at, channel: s.context, client: s.client_label, rep: rep.data?.full_name ?? null, outcome: s.outcome, url: `${origin}/dashboard/remote-sales/calls/${s.id}` },
    brief: { summary: typeof sum === "string" ? sum : null, keyPoints: texts(brief.data?.key_points), nextSteps: texts(brief.data?.next_steps) },
    followUp: { email: email ? { subject: email.subject, body: email.body } : null, text: text ? { body: text.body } : null },
    prospect,
  };
}
