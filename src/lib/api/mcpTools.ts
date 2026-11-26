import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hiddenInCompanyFrom } from "@/lib/coach/remote/hidePhrases";
import { DEAL_CALLS, DEAL_LINES, loadCallsByIds } from "@/lib/coach/remote/revenue/dealCalls";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { writeDealBrief } from "@/lib/coach/remote/revenue/dealBriefRun";
import { basisSessions } from "@/lib/coach/remote/revenue/dealBrief";
import { callsBlock, type CallLines } from "@/lib/coach/remote/revenue/playbook";
import { numberedTranscript } from "@/lib/coach/remote/followThrough";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { mcpAskCoach } from "@/lib/claude";
import { OUTSIDE_READER } from "./publicApi";

/**
 * The MCP server's tools (Engage plan E4; Gong F32.1: ask_deal, ask_account, generate_brief, find_calls; finding deals). They run
 * for a company key with the MCP scope (plan E8): every read is pinned to the key's company with the service role, no
 * call with an active hide is ever read, and an answer cites the call lines it rests on (checked against the lines
 * given). Tool errors come back as text the assistant can read, never as a crash.
 */
export const MCP_TOOLS = [
  {
    name: "list_deals",
    description: "List deals in EloState, newest first. Optionally filter by words in the deal name and by status (open, won, lost).",
    inputSchema: { type: "object", properties: { query: { type: "string" }, status: { type: "string", enum: ["open", "won", "lost"] }, limit: { type: "number", minimum: 1, maximum: 50 } } },
  },
  {
    name: "get_deal",
    description: "One deal: its stage, amount, dates, account, contacts and latest AI brief (where it stands, what happened, risks, next steps).",
    inputSchema: { type: "object", properties: { deal_id: { type: "string" } }, required: ["deal_id"] },
  },
  {
    name: "get_account",
    description: "One account (a company): its deals and contacts.",
    inputSchema: { type: "object", properties: { account_id: { type: "string" } }, required: ["account_id"] },
  },
  {
    name: "ask_deal",
    description: "Ask a question about one deal. Answered only from the transcripts of its latest calls, with references to the call lines.",
    inputSchema: { type: "object", properties: { deal_id: { type: "string" }, question: { type: "string" } }, required: ["deal_id", "question"] },
  },
  {
    name: "ask_account",
    description: "Ask a question about one account (a company) across its deals. Answered only from the transcripts of the account's latest calls, with references to the call lines.",
    inputSchema: { type: "object", properties: { account_id: { type: "string" }, question: { type: "string" } }, required: ["account_id", "question"] },
  },
  {
    name: "generate_brief",
    description: "Write (or return the existing) AI brief for one deal from its latest calls: where it stands, what happened, risks and next steps, each point citing call lines. The brief is saved on the deal.",
    inputSchema: { type: "object", properties: { deal_id: { type: "string" } }, required: ["deal_id"] },
  },
  {
    name: "find_calls",
    description: "Find sales calls, newest first: all of them, or those on one deal or account, optionally since a date (YYYY-MM-DD). Returns ids, dates, channel, rep and outcome — no transcripts.",
    inputSchema: { type: "object", properties: { deal_id: { type: "string" }, account_id: { type: "string" }, since: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 50 } } },
  },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ToolError extends Error {}

export const MCP_ASK_SYSTEM = `You answer a question about one sales deal, using ONLY the transcripts of its calls below.
Cite each claim with the call and line it rests on, written like [C1:12] (call C1, line 12). Cite only lines that appear
below. If the calls don't answer the question, say so plainly. Never invent a person, a figure or a conversation.
Be concise: a few sentences or a short list.`;

/** [C#:#] references in an answer that point at real lines, deduplicated. Pure. */
export function resolveCallRefs(answer: string, calls: CallLines[]): Array<{ ref: string; sessionId: string; seq: number; atMs: number | null }> {
  const out: Array<{ ref: string; sessionId: string; seq: number; atMs: number | null }> = [];
  for (const m of answer.matchAll(/\[C(\d+):(\d+)\]/g)) {
    const call = calls[Number(m[1]) - 1];
    const line = call?.lines.find((l) => l.seq === Number(m[2]));
    if (!call || !line || out.some((o) => o.ref === m[0])) continue;
    out.push({ ref: m[0], sessionId: call.sessionId, seq: line.seq, atMs: line.atMs });
  }
  return out;
}

async function dealInCompany(admin: SupabaseClient, companyId: string, dealId: string) {
  if (!UUID.test(dealId)) throw new ToolError("deal_id must be a deal's id (from list_deals).");
  const { data, error } = await admin.from("remote_prospects_current").select("id, name, status, stage_label, amount, close_date, next_call_date, last_call_at, account_id, created_at").eq("company_id", companyId).eq("id", dealId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ToolError("No deal with that id in this company.");
  return data;
}

/**
 * A deal's calls for an AI read: the newest DEAL_CALLS of its calls with no active hide (hidden calls are left out
 * BEFORE the newest are chosen, as RLS does on the deal page, so a brief written here has the same basis as one written
 * there and is found again instead of paid for twice; review 2026-11-27).
 */
async function dealCallsForCompany(admin: SupabaseClient, companyId: string, dealId: string): Promise<Array<CallLines & { version: number }>> {
  const hidden = await hiddenInCompanyFrom(admin, companyId, OUTSIDE_READER);
  const ids = (await callIdsOfDeals(admin, companyId, [dealId])).filter((id) => !hidden.has(id));
  const calls = await loadCallsByIds(admin, ids, { maxCalls: DEAL_CALLS, maxLines: DEAL_LINES });
  if (calls === "failed") throw new Error("deal calls");
  return calls;
}

async function accountInCompany(admin: SupabaseClient, companyId: string, accountId: string) {
  if (!UUID.test(accountId)) throw new ToolError("account_id must be an account's id (from get_deal or list_deals).");
  const { data, error } = await admin.from("accounts_current").select("id, name, created_at").eq("company_id", companyId).eq("id", accountId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ToolError("No account with that id in this company.");
  return data;
}

/**
 * An account's calls for an AI read: the newest DEAL_CALLS calls across its deals, minus any with an active hide, with
 * the same line budget as one deal's. Only those calls' transcripts are loaded.
 */
async function accountCallsForCompany(admin: SupabaseClient, companyId: string, accountId: string): Promise<CallLines[]> {
  const { data: deals, error } = await admin.from("remote_prospects_current").select("id").eq("company_id", companyId).eq("account_id", accountId).order("created_at", { ascending: false }).order("id").limit(ID_CAP);
  if (error) throw new Error(error.message);
  const hidden = await hiddenInCompanyFrom(admin, companyId, OUTSIDE_READER);
  const ids = (await callIdsOfDeals(admin, companyId, ((deals ?? []) as Array<{ id: string }>).map((d) => String(d.id)))).filter((id) => !hidden.has(id));
  const calls = await loadCallsByIds(admin, ids, { maxCalls: DEAL_CALLS, maxLines: DEAL_LINES });
  if (calls === "failed") throw new Error("account calls");
  return calls;
}

/**
 * Id lists sent in one request stay at ID_CAP: 200 ids is about 7 KB of URL, well inside the gateway's limit (1,000
 * would be about 37 KB and can be refused).
 */
const ID_CAP = 200;

/** The ids of the calls most recently linked to these deals (company-pinned), at most ID_CAP. */
async function callIdsOfDeals(admin: SupabaseClient, companyId: string, dealIds: string[]): Promise<string[]> {
  if (!dealIds.length) return [];
  const { data, error } = await admin.from("remote_prospect_calls").select("session_id").eq("company_id", companyId).in("prospect_id", dealIds.slice(0, ID_CAP)).order("id", { ascending: false }).limit(ID_CAP);
  if (error) throw new Error(error.message);
  return [...new Set(((data ?? []) as Array<{ session_id: string }>).map((r) => String(r.session_id)))];
}

/**
 * `actorId` is the person who made the key: a brief written through generate_brief is recorded as theirs.
 */
export async function runTool(admin: SupabaseClient, companyId: string, name: string, args: Record<string, unknown>, actorId: string): Promise<string> {
  if (name === "list_deals") {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    let q = admin.from("remote_prospects_current").select("id, name, status, stage_label, amount, close_date, account_id").eq("company_id", companyId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
    if (typeof args.status === "string" && ["open", "won", "lost"].includes(args.status)) q = q.eq("status", args.status);
    if (typeof args.query === "string" && args.query.trim()) q = q.ilike("name", `%${args.query.trim().slice(0, 80).replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return JSON.stringify({ deals: data ?? [] });
  }
  if (name === "get_deal") {
    const deal = await dealInCompany(admin, companyId, String(args.deal_id ?? ""));
    const [acc, links, brief] = await Promise.all([
      deal.account_id ? admin.from("accounts_current").select("id, name").eq("company_id", companyId).eq("id", deal.account_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      admin.from("deal_contacts_current").select("contact_id, role").eq("company_id", companyId).eq("prospect_id", deal.id).neq("role", "removed").limit(50),
      admin.from("deal_briefs").select("basis, brief, created_at").eq("company_id", companyId).eq("prospect_id", deal.id).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (acc.error || links.error || brief.error) throw new Error("read");
    const ids = ((links.data ?? []) as Array<{ contact_id: string; role: string }>).map((l) => l.contact_id);
    const { data: cs, error: cErr } = ids.length ? await admin.from("contacts_current").select("id, name, title").eq("company_id", companyId).in("id", ids) : { data: [], error: null };
    if (cErr) throw new Error(cErr.message);
    // A brief quoting a call with an active hide never leaves (an outside reader is exempt from no hide).
    let b = brief.data;
    if (b) {
      const hidden = await hiddenInCompanyFrom(admin, companyId, OUTSIDE_READER);
      if (basisSessions(String(b.basis)).some((id) => hidden.has(id))) b = null;
    }
    return JSON.stringify({ deal, account: acc.data, contacts: cs ?? [], brief: b ? { ...(b.brief as object), writtenAt: b.created_at } : null });
  }
  if (name === "get_account") {
    const id = String(args.account_id ?? "");
    if (!UUID.test(id)) throw new ToolError("account_id must be an account's id.");
    const { data: acc, error } = await admin.from("accounts_current").select("id, name, created_at").eq("company_id", companyId).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!acc) throw new ToolError("No account with that id in this company.");
    const [deals, contacts] = await Promise.all([
      admin.from("remote_prospects_current").select("id, name, status, stage_label, amount, close_date").eq("company_id", companyId).eq("account_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
      admin.from("contacts_current").select("id, name, title").eq("company_id", companyId).eq("account_id", id).order("name").order("id").limit(200),
    ]);
    if (deals.error || contacts.error) throw new Error("read");
    return JSON.stringify({ account: acc, deals: deals.data ?? [], contacts: contacts.data ?? [] });
  }
  if (name === "ask_deal") {
    const question = typeof args.question === "string" ? args.question.trim() : "";
    if (question.length < 3 || question.length > 1000) throw new ToolError("Ask a question of 3 to 1,000 characters.");
    const deal = await dealInCompany(admin, companyId, String(args.deal_id ?? ""));
    const calls = await dealCallsForCompany(admin, companyId, deal.id);
    if (!calls.length) return JSON.stringify({ answer: "This deal has no call transcripts to answer from yet.", references: [] });
    const r = await mcpAskCoach({ companyId, systemPrompt: MCP_ASK_SYSTEM + CONVERSATION_IS_DATA, userMessage: `Deal: ${deal.name ?? "unnamed"} (${deal.status})\n\nCalls:\n${callsBlock(calls, numberedTranscript)}\n\nQuestion: ${question}`, sessionId: calls[0]!.sessionId });
    if (r.suppressed) return JSON.stringify({ answer: "EloState's AI isn't answering for this company right now.", references: [] });
    if (!r.text.trim()) throw new Error("empty answer");
    return JSON.stringify({ answer: r.text.trim(), references: resolveCallRefs(r.text, calls) });
  }
  if (name === "ask_account") {
    const question = typeof args.question === "string" ? args.question.trim() : "";
    if (question.length < 3 || question.length > 1000) throw new ToolError("Ask a question of 3 to 1,000 characters.");
    const acc = await accountInCompany(admin, companyId, String(args.account_id ?? ""));
    const calls = await accountCallsForCompany(admin, companyId, String(acc.id));
    if (!calls.length) return JSON.stringify({ answer: "This account's deals have no call transcripts to answer from yet.", references: [] });
    const r = await mcpAskCoach({ companyId, systemPrompt: MCP_ASK_SYSTEM.replace("one sales deal", "one account (a company) and its deals") + CONVERSATION_IS_DATA, userMessage: `Account: ${acc.name ?? "unnamed"}\n\nCalls:\n${callsBlock(calls, numberedTranscript)}\n\nQuestion: ${question}`, sessionId: calls[0]!.sessionId });
    if (r.suppressed) return JSON.stringify({ answer: "EloState's AI isn't answering for this company right now.", references: [] });
    if (!r.text.trim()) throw new Error("empty answer");
    return JSON.stringify({ answer: r.text.trim(), references: resolveCallRefs(r.text, calls) });
  }
  if (name === "generate_brief") {
    const deal = await dealInCompany(admin, companyId, String(args.deal_id ?? ""));
    const calls = await dealCallsForCompany(admin, companyId, String(deal.id));
    if (!calls.length) throw new ToolError("This deal has no call transcripts to brief from yet.");
    const r = await writeDealBrief(admin, { companyId, prospectId: String(deal.id), actorId, aiCompanyId: companyId, calls });
    if (r === "suppressed") throw new ToolError("EloState's AI isn't answering for this company right now.");
    if (r === "unusable") throw new ToolError("The brief didn't come back usable. Try again.");
    if (r === "failed") throw new Error("brief not saved");
    return JSON.stringify({ brief: r.brief, writtenAt: r.createdAt, alreadyExisted: r.stored });
  }
  if (name === "find_calls") {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    const since = typeof args.since === "string" && args.since ? args.since : null;
    if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new ToolError("since must be a date like 2026-11-01.");
    let ids: string[] | null = null;
    if (typeof args.deal_id === "string" && args.deal_id) {
      const deal = await dealInCompany(admin, companyId, args.deal_id);
      ids = await callIdsOfDeals(admin, companyId, [String(deal.id)]);
    } else if (typeof args.account_id === "string" && args.account_id) {
      const acc = await accountInCompany(admin, companyId, args.account_id);
      const { data: deals, error } = await admin.from("remote_prospects_current").select("id").eq("company_id", companyId).eq("account_id", acc.id).order("created_at", { ascending: false }).order("id").limit(ID_CAP);
      if (error) throw new Error(error.message);
      ids = await callIdsOfDeals(admin, companyId, ((deals ?? []) as Array<{ id: string }>).map((d) => String(d.id)));
    }
    if (ids && !ids.length) return JSON.stringify({ calls: [] });
    const hidden = await hiddenInCompanyFrom(admin, companyId, OUTSIDE_READER);
    // Read a few past the limit so leaving out hidden calls still fills it in the usual case.
    let q = admin.from("coaching_sessions").select("id, agent_id, context, session_kind, started_at, ended_at, outcome").eq("company_id", companyId).in("context", ["phone", "video"]).order("started_at", { ascending: false }).order("id", { ascending: false }).limit(Math.min(200, limit + hidden.size));
    if (ids) q = q.in("id", ids);
    if (since) q = q.gte("started_at", `${since}T00:00:00Z`);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as Array<{ id: string; agent_id: string; context: string; session_kind: string | null; started_at: string; ended_at: string | null; outcome: string | null }>).filter((c) => !hidden.has(String(c.id)) && isSalesCall(c.session_kind ?? "sales")).slice(0, limit);
    const links = await admin.from("remote_prospect_calls").select("session_id, prospect_id").eq("company_id", companyId).in("session_id", rows.map((r) => r.id)).limit(ID_CAP);
    if (links.error) throw new Error(links.error.message);
    const dealOf = new Map(((links.data ?? []) as Array<{ session_id: string; prospect_id: string }>).map((l) => [String(l.session_id), String(l.prospect_id)]));
    return JSON.stringify({
      calls: rows.map((c) => ({ id: c.id, repId: c.agent_id, channel: c.context, kind: c.session_kind, startedAt: c.started_at, endedAt: c.ended_at, outcome: c.outcome, dealId: dealOf.get(String(c.id)) ?? null })),
      note: "Calls with an active hide are left out.",
    });
  }
  throw new ToolError(`Unknown tool: ${name}`);
}
