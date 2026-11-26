import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { fillTemplate, replayEnrolment, type Activity, type EnrolState, type Step } from "./flows";

/**
 * Engage → Today (plan E1; Gong F26.3 to-dos): every live enrolment the caller can see, replayed into its current step
 * and when that step falls due, with the step's text filled for the person. Read through the CALLER's client (the
 * enrolments' RLS follows the deal's, so a rep sees their own and a manager their tree). A failed read throws
 * (EngageReadError), never an empty day.
 */
export class EngageReadError extends Error {}

export type TodayItem = {
  enrolmentId: string;
  flowId: string;
  flowName: string;
  prospectId: string;
  dealName: string | null;
  contactId: string;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  repId: string;
  state: EnrolState;
  stepIndex: number;
  stepCount: number;
  step: (Step & { text: string; subject: string }) | null;
  dueAt: string | null;
  overdue: boolean;
};

export async function listEngage(db: SupabaseClient, opts: { repId?: string; prospectId?: string } = {}): Promise<TodayItem[]> {
  let enrolments: Array<{ id: string; flow_id: string; prospect_id: string; contact_id: string; rep_id: string; created_at: string }>;
  try {
    enrolments = await fetchAllPaged((from, to) => {
      let q = db.from("engage_enrolments").select("id, flow_id, prospect_id, contact_id, rep_id, created_at").order("created_at").order("id");
      if (opts.repId) q = q.eq("rep_id", opts.repId);
      if (opts.prospectId) q = q.eq("prospect_id", opts.prospectId);
      return q.range(from, to);
    }, { label: "enrolments", maxRows: 20_000 });
  } catch (e) {
    throw new EngageReadError(e instanceof Error ? e.message : String(e));
  }
  if (!enrolments.length) return [];
  const chunk = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / 150) }, (_, i) => xs.slice(i * 150, i * 150 + 150));
  const flowIds = [...new Set(enrolments.map((e) => e.flow_id))];
  const dealIds = [...new Set(enrolments.map((e) => e.prospect_id))];
  const contactIds = [...new Set(enrolments.map((e) => e.contact_id))];
  const flows = new Map<string, { name: string; steps: Step[] }>();
  const deals = new Map<string, { name: string | null; account: string | null }>();
  const contacts = new Map<string, { name: string | null; title: string | null; accountId: string | null; email: string | null; phone: string | null }>();
  const acts = new Map<string, Activity[]>();
  for (const ids of chunk(flowIds)) {
    const { data, error } = await db.from("engage_flows").select("id, name, steps").in("id", ids);
    if (error) throw new EngageReadError(`flows: ${error.message}`);
    for (const f of (data ?? []) as Array<{ id: string; name: string; steps: Step[] }>) flows.set(f.id, { name: f.name, steps: f.steps });
  }
  for (const ids of chunk(dealIds)) {
    const { data, error } = await db.from("remote_prospects_current").select("id, name, account_id").in("id", ids);
    if (error) throw new EngageReadError(`deals: ${error.message}`);
    for (const d of (data ?? []) as Array<{ id: string; name: string | null; account_id: string | null }>) deals.set(d.id, { name: d.name, account: d.account_id });
  }
  const accountName = new Map<string, string>();
  const accIds = [...new Set([...deals.values()].map((d) => d.account).filter((x): x is string => !!x))];
  for (const ids of chunk(accIds)) {
    const { data, error } = await db.from("accounts_current").select("id, name").in("id", ids);
    if (error) throw new EngageReadError(`accounts: ${error.message}`);
    for (const a of (data ?? []) as Array<{ id: string; name: string | null }>) accountName.set(a.id, a.name ?? "");
  }
  for (const ids of chunk(contactIds)) {
    const { data, error } = await db.from("contacts_current").select("id, name, title, account_id, email, phone").in("id", ids);
    if (error) throw new EngageReadError(`contacts: ${error.message}`);
    for (const c of (data ?? []) as Array<{ id: string; name: string | null; title: string | null; account_id: string | null; email: string | null; phone: string | null }>) contacts.set(c.id, { name: c.name, title: c.title, accountId: c.account_id, email: c.email, phone: c.phone });
  }
  for (const ids of chunk(enrolments.map((e) => e.id))) {
    let rows: Array<{ enrolment_id: string; step_index: number; action: Activity["action"]; created_at: string; id: number }>;
    try {
      rows = await fetchAllPaged((from, to) => db.from("engage_activities").select("id, enrolment_id, step_index, action, created_at").in("enrolment_id", ids).order("id").range(from, to), { label: "activities", maxRows: 200_000 });
    } catch (e) {
      throw new EngageReadError(e instanceof Error ? e.message : String(e));
    }
    for (const a of rows) acts.set(a.enrolment_id, [...(acts.get(a.enrolment_id) ?? []), { stepIndex: a.step_index, action: a.action, createdAt: a.created_at }]);
  }
  const now = Date.now();
  return enrolments.map((e) => {
    const flow = flows.get(e.flow_id);
    const steps = flow?.steps ?? [];
    const r = replayEnrolment(steps, e.created_at, acts.get(e.id) ?? []);
    const deal = deals.get(e.prospect_id);
    const contact = contacts.get(e.contact_id);
    const company = (contact?.accountId && accountName.get(contact.accountId)) || (deal?.account && accountName.get(deal.account)) || null;
    const raw = steps[r.stepIndex];
    const vars = { name: contact?.name ?? null, company, deal: deal?.name ?? null };
    return {
      enrolmentId: e.id,
      flowId: e.flow_id,
      flowName: flow?.name ?? "A flow",
      prospectId: e.prospect_id,
      dealName: deal?.name ?? null,
      contactId: e.contact_id,
      contactName: contact?.name ?? null,
      contactTitle: contact?.title ?? null,
      contactEmail: contact?.email ?? null,
      contactPhone: contact?.phone ?? null,
      repId: e.rep_id,
      state: r.state,
      stepIndex: r.stepIndex,
      stepCount: steps.length,
      step: raw && r.state !== "finished" && r.state !== "removed" ? { ...raw, subject: fillTemplate(raw.title, vars), text: fillTemplate(raw.body ?? "", vars) } : null,
      dueAt: r.dueAt,
      overdue: !!r.dueAt && Date.parse(r.dueAt) < now,
    };
  });
}
