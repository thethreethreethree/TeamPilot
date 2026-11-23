import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { askCoachTurn } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { listProspects, type ProspectRow } from "./prospects";
import { dealRisk, RISK_WORDS } from "./dealRisk";

/**
 * Ask Coach across a whole pipeline (2026-11-23; Gong's Assistant on Deal and Account Boards). Ask Coach over calls
 * caps at 10 transcripts; a pipeline question ("which deals are at risk?", "what do my stalled deals have in common?")
 * needs every prospect at once. So the AI reads each prospect's pipeline facts and its latest call brief (key points
 * and agreed next steps) — not raw transcripts — in one call. Everything is read through the CALLER's client, so a
 * rep sees their own pipeline and a manager the reports RLS lets them see.
 */
export const PIPELINE_SYSTEM = `You are a sales coach. A rep, or their manager, is asking about their pipeline of prospects.
Answer grounded ONLY in the numbered prospects below: their stage, amount, next call, expected close date, open to-dos and what was said on
their latest call. Cite the prospects you rely on with their numbers in square brackets, e.g. "Acme has no next call
booked [P3]". Cite only numbers that appear below. Never invent a prospect, a figure or a conversation; if the data
cannot answer the question, say what is missing.

Be concrete and practical: name the prospects, the reason, and one next step for each that matters. A few short
paragraphs or a short list at most.`;

/** Prospects read per question — newest activity first. Bounds the prompt for very large pipelines; the answer says so. */
export const PIPELINE_CAP = 60;

export type PipelineCitation = { ref: number; prospectId: string; name: string };
type Brief = { keyPoints: string[]; nextSteps: string[] };

const texts = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? x : typeof (x as { text?: unknown })?.text === "string" ? (x as { text: string }).text : "")).filter(Boolean);

/** Pure: the numbered context the AI reads, and the ref → prospect map. */
export function buildPipelineContext(prospects: ProspectRow[], briefs: Map<string, Brief>, today: string = new Date().toISOString().slice(0, 10)): { text: string; refs: Map<number, { prospectId: string; name: string }> } {
  const refs = new Map<number, { prospectId: string; name: string }>();
  const blocks = prospects.map((p, i) => {
    const n = i + 1;
    const name = p.name ?? "Unnamed prospect";
    refs.set(n, { prospectId: p.id, name });
    const b = briefs.get(p.id);
    const lines = [
      `[P${n}] ${name}${p.organization ? ` (${p.organization})` : ""} — ${p.status}${p.stageLabel ? `, stage "${p.stageLabel}"` : ""}${p.amount !== null ? `, $${p.amount}` : ""}${p.source ? `, source "${p.source}"` : ""}`,
      `   next call: ${p.nextCallDate ? `${p.nextCallDate}${p.nextCallTime ? ` ${p.nextCallTime}` : ""}` : "none booked"} · expected close: ${p.closeDate ?? "not set"} · last call: ${p.lastCallAt ? p.lastCallAt.slice(0, 10) : "none"} · calls: ${p.callCount} · open to-dos: ${p.openTodos}${p.nextTodo ? ` (next: "${p.nextTodo.title}"${p.nextTodo.due ? ` due ${p.nextTodo.due}` : ""})` : ""}`,
    ];
    // The same risk rule the Pipeline shows (dealRisk.ts), so the answer and the screen agree (§2.2).
    const risk = dealRisk(p, today);
    if (p.sentiment) lines.push(`   customer sentiment on the last call: ${p.sentiment.last}${p.sentiment.trend ? ` (${p.sentiment.trend === "steady" ? "same as" : p.sentiment.trend === "warming" ? "better than" : "worse than"} the call before)` : ""}`);
    if (risk.level !== "ok") lines.push(`   risk: ${risk.level === "at_risk" ? "AT RISK" : "watch"} — ${risk.reasons.filter((x) => x !== "no_amount").map((x) => RISK_WORDS[x]).join("; ")}`);
    if (b?.keyPoints.length) lines.push(`   latest call — key points: ${b.keyPoints.slice(0, 5).join(" | ")}`);
    if (b?.nextSteps.length) lines.push(`   latest call — agreed next steps: ${b.nextSteps.slice(0, 5).join(" | ")}`);
    return lines.join("\n");
  });
  return { text: blocks.join("\n"), refs };
}

/** Pure: [P#] citations in the answer that name a real prospect, deduplicated, in order of first use. */
export function resolvePipelineCitations(answer: string, refs: Map<number, { prospectId: string; name: string }>): PipelineCitation[] {
  const out: PipelineCitation[] = [];
  const seen = new Set<number>();
  for (const m of answer.matchAll(/\[P(\d+)\]/g)) {
    const n = Number(m[1]);
    const r = refs.get(n);
    if (!r || seen.has(n)) continue;
    seen.add(n);
    out.push({ ref: n, prospectId: r.prospectId, name: r.name });
  }
  return out;
}

export type PipelineAnswer =
  | { ok: true; suppressed: true }
  | { ok: true; suppressed: false; answer: string; citations: PipelineCitation[]; prospects: number; capped: boolean }
  | { ok: false; status: 400 | 500 | 502; error: string };

export async function askPipeline(args: { db: SupabaseClient; companyId: string; repId?: string; question: string; today?: string }): Promise<PipelineAnswer> {
  const { db, companyId, question } = args;
  const all = await listProspects(db, args.repId, { sentiment: true });
  if (all === null) return { ok: false, status: 500, error: "Couldn't read the pipeline — try again." };
  if (all.length === 0) return { ok: false, status: 400, error: "There are no prospects in this pipeline yet." };
  const activity = (p: ProspectRow) => p.lastCallAt ?? p.createdAt;
  const prospects = [...all].sort((a, b) => activity(b).localeCompare(activity(a))).slice(0, PIPELINE_CAP);

  // Each prospect's calls, then the latest brief per prospect. A failed read stops before the paid AI call.
  const ids = prospects.map((p) => p.id);
  const { data: links, error: lErr } = await db.from("remote_prospect_calls").select("prospect_id, session_id, created_at").in("prospect_id", ids);
  if (lErr) return { ok: false, status: 500, error: "Couldn't read the pipeline's calls — try again." };
  const linkRows = (links ?? []) as Array<{ prospect_id: string; session_id: string }>;
  const sessionIds = [...new Set(linkRows.map((l) => l.session_id))];
  const briefs = new Map<string, Brief>();
  if (sessionIds.length) {
    const { data: rows, error: bErr } = await db
      .from("remote_call_briefs")
      .select("session_id, key_points, next_steps, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: false });
    if (bErr) return { ok: false, status: 500, error: "Couldn't read the call briefs — try again." };
    const latestBySession = new Map<string, { key_points: unknown; next_steps: unknown; created_at: string }>();
    for (const r of (rows ?? []) as Array<{ session_id: string; key_points: unknown; next_steps: unknown; created_at: string }>) {
      if (!latestBySession.has(r.session_id)) latestBySession.set(r.session_id, r);
    }
    for (const p of prospects) {
      const mine = linkRows.filter((l) => l.prospect_id === p.id).map((l) => latestBySession.get(l.session_id)).filter(Boolean) as Array<{ key_points: unknown; next_steps: unknown; created_at: string }>;
      const newest = mine.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (newest) briefs.set(p.id, { keyPoints: texts(newest.key_points), nextSteps: texts(newest.next_steps) });
    }
  }

  const { text, refs } = buildPipelineContext(prospects, briefs, args.today);
  const capped = all.length > prospects.length;
  const r = await askCoachTurn({
    companyId,
    systemPrompt: PIPELINE_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: `Pipeline (${prospects.length} prospect${prospects.length === 1 ? "" : "s"}${capped ? `, the ${PIPELINE_CAP} with the most recent activity of ${all.length}` : ""}):\n${text}\n\nQuestion: ${question}`,
    sessionId: null,
  });
  if (r.suppressed) return { ok: true, suppressed: true };
  const answer = r.text.trim();
  if (!answer) return { ok: false, status: 502, error: "The coach didn't answer. Try again." };
  return { ok: true, suppressed: false, answer, citations: resolvePipelineCitations(answer, refs), prospects: prospects.length, capped };
}
