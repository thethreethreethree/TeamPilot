import "server-only";
import { hiddenFrom } from "@/lib/coach/remote/hidePhrases";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { askCoachTurn } from "@/lib/claude";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { getSession } from "@/lib/data/salesCoach";
import { isSalesCall } from "@/lib/coach/v5/salesOnly";
import { loadLines, type Line } from "./followThrough";
import { audioBaseIso } from "@/lib/coach/v5/segmentTiming";
import { readPitchScore, type StoredPitch } from "@/lib/coach/pitchScore/readPitchScore";

/**
 * RSS Phase 6 — Ask Coach, multi-turn, saved, with clickable timestamp citations, over one call or several
 * (Gong F13.8, F13.9, F13.13; migration 0281).
 *
 * ACCESS. Every call is opened through the CALLER's client (getSession + the transcript view, RLS + the 0273 tree);
 * a call the caller cannot open is refused, never silently skipped. Chats are the asker's own (0281 header).
 * CITATIONS. Lines are numbered [1]..[n] across all calls; the model cites [n]; the server maps each [n] it can
 * resolve to {sessionId, seq, atMs} and drops any it cannot — a citation always points at a real line.
 * Day-1 like every Sales Coach engine (controlExempt), consuming the `suppressed` verdict (§2.2).
 * COMPOSES WITH THE SCORECARD (ThinkerThinker A16, audit 2026-11-21). Each call's stored Pitch Score — the grades the
 * rep sees on screen, manager corrections already applied (0256 writes the corrected grade) — goes in beside its
 * transcript, read through readPitchScore on the caller's client (its access rule, its numbers; nothing recomputed
 * here, §2.2). Without it the coach could call an objection "handled well" that the scorecard marked missed, and the
 * rep would see the System contradict itself. The coach may still read a moment differently — it must say so, naming
 * the grade, rather than silently disagree.
 */
export const ASK_SYSTEM = `You are a sales coach. The rep (or their manager) is asking about one or more recorded sales calls.
Answer grounded ONLY in the numbered transcript lines below and in sound sales practice.

Cite the lines you rely on with their numbers in square brackets, e.g. "when the customer raised price [14]". Cite
only numbers that appear below. Never invent a moment.

A call may come with its scorecard: the grades the rep already sees on screen. Do not silently contradict it. When
the transcript leads you to a different read of something it graded, say so plainly: name the scorecard's grade,
then what you see, with line numbers — so the rep can raise it with their manager. A grade a manager corrected is
the grade. If a scorecard "could not be read", do not guess what it says.

Tone: kind and growth-oriented. Point at specific moments. A different approach is an opportunity with one concrete,
practiceable next step — never a verdict. A few short paragraphs at most.`;

export type Citation = { ref: number; sessionId: string; seq: number; atMs: number | null };
export type Turn = { role: "user" | "coach"; content: string; citations: Citation[] };
export type AskResult =
  | { ok: true; chatId: string | null; answer: string; citations: Citation[]; suppressed: false }
  | { ok: true; chatId: null; answer: null; citations: []; suppressed: true }
  | { ok: false; status: 400 | 403 | 404 | 409 | 500 | 502; error: string };

const MAX_LINES = 900;

/** The lines kept from one call: its opening, or — with `focus` — the lines around each mention first. Pure. */
export function keepLines(lines: Line[], keep: number, focus?: string[]): { lines: Line[]; around: boolean } {
  if (keep >= lines.length) return { lines, around: false };
  const terms = (focus ?? []).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2);
  if (!terms.length) return { lines: lines.slice(0, keep), around: false };
  const W = 6; // lines either side of a mention
  const pick = new Set<number>();
  lines.forEach((l, i) => {
    if (pick.size >= keep) return;
    if (!terms.some((t) => l.text.toLowerCase().includes(t))) return;
    for (let j = Math.max(0, i - W); j <= Math.min(lines.length - 1, i + W) && pick.size < keep; j++) pick.add(j);
  });
  if (!pick.size) return { lines: lines.slice(0, keep), around: false };
  return { lines: [...pick].sort((a, b) => a - b).map((i) => lines[i]!), around: true };
}

/**
 * Number lines across calls, keeping each call's share proportional when the total is over the cap. With `focus`
 * (review 2026-11-28; the battlecard's competitor), a long call keeps the lines around each mention, not its opening.
 * Pure.
 */
export function numberAcross(calls: Array<{ sessionId: string; label: string; lines: Line[] }>, focus?: string[]): { text: string; refs: Map<number, Citation> } {
  const total = calls.reduce((n, c) => n + c.lines.length, 0);
  const refs = new Map<number, Citation>();
  const parts: string[] = [];
  let n = 0;
  for (const c of calls) {
    const keep = total > MAX_LINES ? Math.max(20, Math.floor((c.lines.length / total) * MAX_LINES)) : c.lines.length;
    const kept = keepLines(c.lines, keep, focus);
    const lines = kept.lines;
    parts.push(`=== Call: ${c.label}${lines.length < c.lines.length ? (kept.around ? ` (${lines.length} of ${c.lines.length} lines, around the mentions)` : ` (first ${lines.length} of ${c.lines.length} lines)`) : ""} ===`);
    for (const l of lines) {
      n += 1;
      refs.set(n, { ref: n, sessionId: c.sessionId, seq: l.seq, atMs: l.atMs });
      const who = l.speaker === "rep" ? "REP" : l.speaker === "customer" ? "CUSTOMER" : "UNCLEAR";
      parts.push(`[${n}] ${who}: ${l.text}`);
    }
  }
  return { text: parts.join("\n"), refs };
}

const GRADE_WORD: Record<StoredPitch["elements"][number]["grade"], string> = { hit: "hit", partial: "partial", missed: "missed", na: "doesn't apply (manager)" };

/** The stored verdict as plain lines for the model. Pure; formats only — every number is the stored one. */
export function scorecardText(label: string, pitch: StoredPitch | null | "unreadable"): string {
  if (pitch === "unreadable") return `=== Scorecard: ${label} — could not be read right now ===`;
  if (!pitch) return `=== Scorecard: ${label} — not scored ===`;
  const out = [
    `=== Scorecard: ${label} — ${pitch.total} points${pitch.band ? ` (${pitch.band})` : ""}${pitch.qualifying ? "" : `, not qualifying: ${pitch.notQualifyingReason ?? "no reason stored"}`} ===`,
  ];
  for (const e of pitch.elements) {
    const ev = e.evidence ? ` — "${e.evidence.replace(/\s+/g, " ").slice(0, 160)}"` : "";
    out.push(`- ${e.label}: ${GRADE_WORD[e.grade]}${ev}`);
  }
  for (const o of pitch.overrides.slice(0, 10)) {
    out.push(`- manager corrected ${o.itemLabel}: ${o.oldValue ?? "—"} → ${o.newValue} (${o.reason.slice(0, 160)})`);
  }
  return out.join("\n");
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
  /** false (Engage E9, on-demand agents): answer without keeping a chat — nothing is stored. Default true. */
  save?: boolean;
  /** Words whose surrounding lines are kept first when calls are too long to send whole (E14 battlecards). */
  focus?: string[];
}): Promise<AskResult> {
  const { db, companyId, userId, question } = args;
  const admin = createAdminClient();

  // The chat (if continuing): the asker's own, and its calls are the calls.
  let sessionIds = [...new Set(args.sessionIds)];
  const history: Turn[] = [];
  if (args.chatId) {
    const { data: chat, error: chatErr } = await admin
      .from("ask_coach_chats")
      .select("id, session_ids")
      .eq("company_id", companyId)
      .eq("owner_id", userId)
      .eq("id", args.chatId)
      .maybeSingle();
    // Failed reads are "try again", never "not found" or a context-free answer (2026-11-23).
    if (chatErr) return { ok: false, status: 500, error: "Couldn't open this chat — try again." };
    if (!chat) return { ok: false, status: 404, error: "Chat not found." };
    sessionIds = (chat.session_ids as string[]).map(String);
    const { data: turns, error: turnsErr } = await admin
      .from("ask_coach_turns")
      .select("role, content, citations")
      .eq("company_id", companyId)
      .eq("chat_id", args.chatId)
      .order("id", { ascending: true })
      .limit(40);
    // Without the earlier turns a follow-up question would be answered out of context — and billed.
    if (turnsErr) return { ok: false, status: 500, error: "Couldn't load this chat's earlier answers — try again." };
    for (const t of (turns ?? []) as Array<{ role: "user" | "coach"; content: string; citations: Citation[] }>) history.push(t);
  }
  if (sessionIds.length === 0 || sessionIds.length > 10) return { ok: false, status: 400, error: "Ask about 1 to 10 calls." };

  // Every call opened as the caller.
  const calls: Array<{ sessionId: string; label: string; lines: Line[] }> = [];
  const scorecards: string[] = [];
  for (const id of sessionIds) {
    const s = await getSession(id, db);
    if (!s) return { ok: false, status: 404, error: "One of these calls isn't available to you." };
    if (!isSalesCall(s.sessionKind)) return { ok: false, status: 409, error: "Ask Coach is for sales calls." };
    const loaded = await loadLines(db, id, audioBaseIso(s.startedAt, s.audioStartedAt) ?? s.startedAt);
    // A failed read (null) is not "no transcript": dropping the call would answer about fewer calls than were asked
    // about, and if all failed the rep was told the calls have no transcript. Stop before the AI call.
    if (!loaded) return { ok: false, status: 500, error: "Couldn't read one of these calls' transcripts — try again." };
    if (loaded.lines.length > 0) {
      const label = `${s.clientLabel ?? "Untitled"} (${new Date(s.startedAt).toISOString().slice(0, 10)})`;
      calls.push({ sessionId: id, label, lines: loaded.lines });
      // A failed read is said as such to the model — never presented as "not scored" (the confident-zero shape).
      let pitch: StoredPitch | null | "unreadable";
      try {
        pitch = await readPitchScore(id, db);
      } catch (err) {
        console.error(`[askCoach] scorecard read failed session=${id}:`, err);
        pitch = "unreadable";
      }
      scorecards.push(scorecardText(label, pitch));
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

  const { text, refs } = numberAcross(calls, args.focus);
  const prior = history
    .slice(-10)
    .map((t) => `${t.role === "user" ? "QUESTION" : "YOUR EARLIER ANSWER"}: ${t.content}`)
    .join("\n\n");
  const r = await askCoachTurn({
    companyId,
    systemPrompt: ASK_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: `Transcript lines:\n${text}\n\nScorecards:\n${scorecards.join("\n\n")}\n\n${prior ? `Conversation so far:\n${prior}\n\n` : ""}Question: ${question}`,
    sessionId: calls.length === 1 ? (calls[0]?.sessionId ?? null) : null,
  });
  if (r.suppressed) return { ok: true, chatId: null, answer: null, citations: [], suppressed: true };
  const answer = r.text.trim();
  if (!answer) return { ok: false, status: 502, error: "Ask-coach failed." };
  const citations = resolveCitations(answer, refs);

  if (args.save === false) return { ok: true, chatId: null, answer, citations, suppressed: false };
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
  // 0337: a chat that covers any call a company phrase hid from the asker is withheld — its answers quote the call.
  // The database's verdict (hiddenFrom); a failed check withholds them all ("unavailable"), never shows them.
  const listed = (chats ?? []) as Array<{ id: string; session_ids: string[] | null }>;
  let hidden: Set<string>;
  try {
    hidden = await hiddenFrom(admin, listed.flatMap((c) => c.session_ids ?? []), userId);
  } catch (e) {
    console.error(`[askCoach] hidden check failed: ${e instanceof Error ? e.message : String(e)}`);
    return { available: false as const };
  }
  const shown = listed.filter((c) => !(c.session_ids ?? []).some((id) => hidden.has(String(id))));
  const ids = shown.map((c) => c.id);
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
    chats: (shown as Array<{ id: string; title: string; session_ids: string[]; created_at: string }>).map((c) => ({
      id: c.id,
      title: c.title,
      sessionIds: c.session_ids,
      createdAt: c.created_at,
      turns: byChat.get(c.id) ?? [],
    })),
  };
}

// ── Deep Ask (Engage plan E18; Gong F13.12) ─────────────────────────────────────────────────────────────────────────
/** Calls a deep question may read at most, and per batch: at most DEEP_MAX / DEEP_BATCH + 1 AI calls per question. */
export const DEEP_MAX = 50;
export const DEEP_BATCH = 10;

/**
 * One batch's answer with its citations renumbered from `start` (so every batch's [n] is unique across the question),
 * keeping only the references it actually cited. Pure.
 */
export function renumber(answer: string, citations: Citation[], start: number): { text: string; refs: Citation[] } {
  const map = new Map<number, number>();
  const refs: Citation[] = [];
  for (const c of citations) {
    const g = start + refs.length;
    map.set(c.ref, g);
    refs.push({ ...c, ref: g });
  }
  // A bracketed number that isn't a citation ("in [2024]") is kept as plain text, never deleted or taken for one.
  const text = answer.replace(/\[(\d{1,4})\]/g, (m, n: string) => (map.has(Number(n)) ? `[${map.get(Number(n))}]` : `(${n})`));
  return { text, refs };
}

export const DEEP_COMBINE_SYSTEM = `You combine partial answers to ONE question about a set of sales calls into one answer.
Each partial answer covers a different batch of calls and cites transcript lines as [numbers].
- Answer the question once, from the partial answers only. Never add a fact they don't contain.
- Keep every [number] you use exactly as written, next to the point it supports. Never invent or change a number.
- Where batches disagree, say so plainly. Kind and growth-oriented, a few short paragraphs at most.`;

/**
 * A question over up to DEEP_MAX calls: DEEP_BATCH at a time through askCoach (each call opened as the asker; nothing
 * saved), then one combining answer that keeps the batches' citations. The AI being off for the company in any batch is
 * the whole answer's verdict (suppressed), never a partial answer said as whole.
 */
export async function askCoachDeep(args: { db: SupabaseClient; companyId: string; userId: string; sessionIds: string[]; question: string }): Promise<AskResult & { batches?: number; skipped?: number }> {
  const ids0 = [...new Set(args.sessionIds)];
  if (ids0.length <= DEEP_BATCH || ids0.length > DEEP_MAX) return { ok: false, status: 400, error: `A deep question reads ${DEEP_BATCH + 1} to ${DEEP_MAX} calls.` };
  // Every call opened first, as the asker (review 2026-11-28): one that isn't theirs to open, or isn't a sales call, is
  // skipped and counted — before any AI call, so a bad call never fails the question after batches were paid for.
  const opened = await Promise.all(ids0.map(async (id) => {
    try {
      const s = await getSession(id, args.db);
      return s && isSalesCall(s.sessionKind) ? id : null;
    } catch {
      return null;
    }
  }));
  const ids = opened.filter((x): x is string => !!x);
  const skipped = ids0.length - ids.length;
  if (!ids.length) return { ok: false, status: 404, error: "None of these calls is available to you." };
  // The batches at once (review 2026-11-28: one after another could run past the time limit).
  const batchIds: string[][] = [];
  for (let i = 0; i < ids.length; i += DEEP_BATCH) batchIds.push(ids.slice(i, i + DEEP_BATCH));
  const results = await Promise.all(batchIds.map((b) => askCoach({ db: args.db, companyId: args.companyId, userId: args.userId, sessionIds: b, question: args.question, chatId: null, save: false })));
  const parts: string[] = [];
  const allRefs: Citation[] = [];
  const batches = results.length;
  for (const [i, r] of results.entries()) {
    if (!r.ok) return r;
    if (r.suppressed) return { ok: true, chatId: null, answer: null, citations: [], suppressed: true };
    // An answer that cites nothing still counts ("none of these discussed budget" is a finding), its numbers as text.
    const n = renumber(r.answer, r.citations, allRefs.length + 1);
    allRefs.push(...n.refs);
    parts.push(`=== Batch ${i + 1} ===\n${n.text}`);
  }
  if (parts.length === 1) {
    const only = parts[0]!.replace(/^=== Batch \d+ ===\n/, "");
    return { ok: true, chatId: null, answer: only, citations: resolveCitations(only, new Map(allRefs.map((c) => [c.ref, c]))), suppressed: false, batches, skipped };
  }
  const r = await askCoachTurn({
    companyId: args.companyId,
    systemPrompt: DEEP_COMBINE_SYSTEM + CONVERSATION_IS_DATA,
    userMessage: `Question: ${args.question}\n\nPartial answers:\n${parts.join("\n\n")}`,
    sessionId: null,
  });
  if (r.suppressed) return { ok: true, chatId: null, answer: null, citations: [], suppressed: true };
  const answer = r.text.trim();
  if (!answer) return { ok: false, status: 502, error: "Ask-coach failed." };
  // Only numbers that were given resolve (resolveCitations drops any the model invented).
  return { ok: true, chatId: null, answer, citations: resolveCitations(answer, new Map(allRefs.map((c) => [c.ref, c]))), suppressed: false, batches, skipped };
}
