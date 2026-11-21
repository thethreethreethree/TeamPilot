import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { askCoachTurn } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { loadLines, type Line } from "./followThrough";

/**
 * RSS Phase 6 — Ask Coach, multi-turn, saved, with clickable timestamp citations, over one call or several
 * (Gong F13.8, F13.9, F13.13; migration 0281).
 *
 * ACCESS. Every call is opened through the CALLER's client (getSession + the transcript view, RLS + the 0273 tree);
 * a call the caller cannot open is refused, never silently skipped. Chats are the asker's own (0281 header).
 * CITATIONS. Lines are numbered [1]..[n] across all calls; the model cites [n]; the server maps each [n] it can
 * resolve to {sessionId, seq, atMs} and drops any it cannot — a citation always points at a real line.
 * Day-1 like every Sales Coach engine (controlExempt), consuming the `suppressed` verdict (§2.2).
 */
export const ASK_SYSTEM = `You are a sales coach. The rep (or their manager) is asking about one or more recorded sales calls.
Answer grounded ONLY in the numbered transcript lines below and in sound sales practice.

Cite the lines you rely on with their numbers in square brackets, e.g. "when the customer raised price [14]". Cite
only numbers that appear below. Never invent a moment.

Tone: kind and growth-oriented. Point at specific moments. A different approach is an opportunity with one concrete,
practiceable next step — never a verdict. A few short paragraphs at most.`;

export type Citation = { ref: number; sessionId: string; seq: number; atMs: number | null };
export type Turn = { role: "user" | "coach"; content: string; citations: Citation[] };
export type AskResult =
  | { ok: true; chatId: string | null; answer: string; citations: Citation[]; suppressed: false }
  | { ok: true; chatId: null; answer: null; citations: []; suppressed: true }
  | { ok: false; status: 400 | 403 | 404 | 409 | 502; error: string };

const MAX_LINES = 900;

/** Number lines across calls, keeping each call's share proportional when the total is over the cap. Pure. */
export function numberAcross(calls: Array<{ sessionId: string; label: string; lines: Line[] }>): { text: string; refs: Map<number, Citation> } {
  const total = calls.reduce((n, c) => n + c.lines.length, 0);
  const refs = new Map<number, Citation>();
  const parts: string[] = [];
  let n = 0;
  for (const c of calls) {
    const keep = total > MAX_LINES ? Math.max(20, Math.floor((c.lines.length / total) * MAX_LINES)) : c.lines.length;
    const lines = c.lines.slice(0, keep);
    parts.push(`=== Call: ${c.label}${keep < c.lines.length ? ` (first ${keep} of ${c.lines.length} lines)` : ""} ===`);
    for (const l of lines) {
      n += 1;
      refs.set(n, { ref: n, sessionId: c.sessionId, seq: l.seq, atMs: l.atMs });
      const who = l.speaker === "rep" ? "REP" : l.speaker === "customer" ? "CUSTOMER" : "UNCLEAR";
      parts.push(`[${n}] ${who}: ${l.text}`);
    }
  }
  return { text: parts.join("\n"), refs };
}

/** The [n] citations in an answer that resolve to a real line, in first-mention order, deduplicated. Pure. */
export function resolveCitations(answer: string, refs: Map<number, Citation>): Citation[] {
  const seen = new Set<number>();
  const out: Citation[] = [];
  for (const m of answer.matchAll(/\[(\d{1,4})\]/g)) {
    const n = Number(m[1]);
    const c = refs.get(n);
    if (c && !seen.has(n)) {
      seen.add(n);
      out.push(c);
    }
  }
  return out;
}

export async function askCoach(args: {
  db: SupabaseClient; // the caller's client
  companyId: string;
  userId: string;
  sessionIds: string[];
  question: string;
  chatId: string | null;
}): Promise<AskResult> {
  const { db, companyId, userId, question } = args;
  const admin = createAdminClient();

  // The chat (if continuing): the asker's own, and its calls are the calls.
  let sessionIds = [...new Set(args.sessionIds)];
  const history: Turn[] = [];
  if (args.chatId) {
    const { data: chat } = await admin
      .from("ask_coach_chats")
      .select("id, session_ids")
      .eq("company_id", companyId)
      .eq("owner_id", userId)
      .eq("id", args.chatId)
      .maybeSingle();
    if (!chat) return { ok: false, status: 404, error: "Chat not found." };
    sessionIds = (chat.session_ids as string[]).map(String);
    const { data: turns } = await admin
      .from("ask_coach_turns")
      .select("role, content, citations")
      .eq("company_id", companyId)
      .eq("chat_id", args.chatId)
      .order("id", { ascending: true })
      .limit(40);
    for (const t of (turns ?? []) as Array<{ role: "user" | "coach"; content: string; citations: Citation[] }>) history.push(t);
  }
  if (sessionIds.length === 0 || sessionIds.length > 10) return { ok: false, status: 400, error: "Ask about 1 to 10 calls." };

  // Every call opened as the caller.
  const calls: Array<{ sessionId: string; label: string; lines: Line[] }> = [];
  for (const id of sessionIds) {
    const s = await getSession(id, db);
    if (!s) return { ok: false, status: 404, error: "One of these calls isn't available to you." };
    if (!isSalesCall(s.sessionKind)) return { ok: false, status: 409, error: "Ask Coach is for sales calls." };
    const loaded = await loadLines(db, id, s.startedAt);
    if (loaded && loaded.lines.length > 0) {
      calls.push({ sessionId: id, label: `${s.clientLabel ?? "Untitled"} (${new Date(s.startedAt).toISOString().slice(0, 10)})`, lines: loaded.lines });
    }
  }
  if (calls.length === 0) {
    return {
      ok: true,
      chatId: null,
      suppressed: false,
      citations: [],
      answer:
        "There's no transcript on these calls yet, so I can't coach from them. Upload the recording (or add the transcript) first, then ask me anything about how it went.",
    };
  }

  const { text, refs } = numberAcross(calls);
  const prior = history
    .slice(-10)
    .map((t) => `${t.role === "user" ? "QUESTION" : "YOUR EARLIER ANSWER"}: ${t.content}`)
    .join("\n\n");
  const r = await askCoachTurn({
    companyId,
    systemPrompt: ASK_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: `Transcript lines:\n${text}\n\n${prior ? `Conversation so far:\n${prior}\n\n` : ""}Question: ${question}`,
    sessionId: calls.length === 1 ? (calls[0]?.sessionId ?? null) : null,
  });
  if (r.suppressed) return { ok: true, chatId: null, answer: null, citations: [], suppressed: true };
  const answer = r.text.trim();
  if (!answer) return { ok: false, status: 502, error: "Ask-coach failed." };
  const citations = resolveCitations(answer, refs);

  // Save (best-effort: a lost save must not lose the answer the person is waiting for).
  let chatId = args.chatId;
  try {
    if (!chatId) {
      const { data: chat, error } = await admin
        .from("ask_coach_chats")
        .insert({ company_id: companyId, owner_id: userId, session_ids: calls.map((c) => c.sessionId), title: question.slice(0, 120) })
        .select("id")
        .maybeSingle();
      if (error) console.error(`[askCoach] chat save failed: ${error.message}`);
      chatId = chat ? String(chat.id) : null;
    }
    if (chatId) {
      const { error } = await admin.from("ask_coach_turns").insert([
        { chat_id: chatId, company_id: companyId, role: "user", content: question.slice(0, 8000), citations: [] },
        { chat_id: chatId, company_id: companyId, role: "coach", content: answer.slice(0, 8000), citations },
      ]);
      if (error) console.error(`[askCoach] turn save failed: ${error.message}`);
    }
  } catch (err) {
    console.error("[askCoach] save threw:", err);
  }
  return { ok: true, chatId, answer, citations, suppressed: false };
}

/** The asker's saved chats that include this call, with their turns (newest chat first). */
export async function listChats(companyId: string, userId: string, sessionId: string) {
  const admin = createAdminClient();
  const { data: chats, error } = await admin
    .from("ask_coach_chats")
    .select("id, title, session_ids, created_at")
    .eq("company_id", companyId)
    .eq("owner_id", userId)
    .contains("session_ids", [sessionId])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { available: false as const };
  const ids = ((chats ?? []) as Array<{ id: string }>).map((c) => c.id);
  const { data: turns } = ids.length
    ? await admin
        .from("ask_coach_turns")
        .select("chat_id, role, content, citations")
        .eq("company_id", companyId)
        .in("chat_id", ids)
        .order("id", { ascending: true })
    : { data: [] };
  const byChat = new Map<string, Turn[]>();
  for (const t of (turns ?? []) as Array<{ chat_id: string } & Turn>) {
    byChat.set(t.chat_id, [...(byChat.get(t.chat_id) ?? []), { role: t.role, content: t.content, citations: t.citations ?? [] }]);
  }
  return {
    available: true as const,
    chats: ((chats ?? []) as Array<{ id: string; title: string; session_ids: string[]; created_at: string }>).map((c) => ({
      id: c.id,
      title: c.title,
      sessionIds: c.session_ids,
      createdAt: c.created_at,
      turns: byChat.get(c.id) ?? [],
    })),
  };
}
