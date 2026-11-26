import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hiddenInCompanyFrom } from "@/lib/coach/remote/hidePhrases";
import { loadDealCalls } from "@/lib/coach/remote/revenue/dealCalls";
import { callsBlock, type CallLines } from "@/lib/coach/remote/revenue/playbook";
import { numberedTranscript } from "@/lib/coach/remote/followThrough";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { mcpAskCoach } from "@/lib/claude";
import { OUTSIDE_READER } from "./publicApi";

/**
 * The MCP server's tools (Engage plan E4; Gong F32.1: ask_deal, ask_account, generate_brief; finding deals). They run
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

/** A deal's calls for an AI read, minus any call with an active hide (an outside reader is exempt from none). */
async function dealCallsForCompany(admin: SupabaseClient, companyId: string, dealId: string): Promise<CallLines[]> {
  const dc = await loadDealCalls(admin, dealId);
  if (dc === "failed") throw new Error("deal calls");
  const hidden = await hiddenInCompanyFrom(admin, companyId, OUTSIDE_READER);
  return dc.calls.filter((c) => !hidden.has(c.sessionId));
}

export async function runTool(admin: SupabaseClient, companyId: string, name: string, args: Record<string, unknown>): Promise<string> {
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
      admin.from("deal_briefs").select("brief, created_at").eq("company_id", companyId).eq("prospect_id", deal.id).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (acc.error || links.error || brief.error) throw new Error("read");
    const ids = ((links.data ?? []) as Array<{ contact_id: string; role: string }>).map((l) => l.contact_id);
    const { data: cs, error: cErr } = ids.length ? await admin.from("contacts_current").select("id, name, title").eq("company_id", companyId).in("id", ids) : { data: [], error: null };
    if (cErr) throw new Error(cErr.message);
    return JSON.stringify({ deal, account: acc.data, contacts: cs ?? [], brief: brief.data ? { ...(brief.data.brief as object), writtenAt: brief.data.created_at } : null });
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
  throw new ToolError(`Unknown tool: ${name}`);
}
