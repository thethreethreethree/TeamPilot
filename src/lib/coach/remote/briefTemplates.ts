/**
 * Brief templates (2026-11-26, Gong ledger F13.2; migration 0364). A manager writes the questions a call should answer
 * ("What budget did they mention?", "Who else decides?"), each with optional instructions; anyone who can open a call
 * runs a template on it and gets an answer per question.
 *
 * HONESTY GUARDS, enforced here, not trusted to the prompt (the call brief's discipline, callBrief.ts):
 *   · an answer must cite transcript lines that exist; an answer with none is stored as NOT_DISCUSSED, so nothing on
 *     the page can be invented;
 *   · answers come back in the template's order, one per question, capped in length;
 *   · stored once per (call, template, transcript version), so the page shows the same read every time.
 * Pure, so it is tested.
 */
import type { Line } from "./followThrough";

export const MAX_SECTIONS = 8;
export const QUESTION_MAX = 200;
export const INSTRUCTIONS_MAX = 600;
export const NAME_MAX = 60;
export const NOT_DISCUSSED = "Not discussed on this call.";

export type Section = { question: string; instructions: string };
/** atMs: each cited line's time in the call (null when the line has none), so a citation can play from there. */
export type Answer = { question: string; answer: string; seqs: number[]; atMs?: Array<number | null> };

/** The sections a manager sent, checked. Returns an error sentence or the sections. */
export function parseSections(raw: unknown): { ok: true; sections: Section[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Add at least one question." };
  if (raw.length > MAX_SECTIONS) return { ok: false, error: `A template has at most ${MAX_SECTIONS} questions.` };
  const out: Section[] = [];
  for (const [i, r] of raw.entries()) {
    const o = (r ?? {}) as { question?: unknown; instructions?: unknown };
    const question = typeof o.question === "string" ? o.question.trim() : "";
    const instructions = typeof o.instructions === "string" ? o.instructions.trim() : "";
    if (!question || question.length > QUESTION_MAX) return { ok: false, error: `Question ${i + 1} needs to be 1–${QUESTION_MAX} characters.` };
    if (instructions.length > INSTRUCTIONS_MAX) return { ok: false, error: `Question ${i + 1}'s instructions are over ${INSTRUCTIONS_MAX} characters.` };
    out.push({ question, instructions });
  }
  return { ok: true, sections: out };
}

export const CUSTOM_BRIEF_SYSTEM = `You read the transcript of a sales call and answer the manager's questions about it, as JSON only.

Return exactly: {"answers": [{"n": <question number>, "answer": "...", "seq": [<line numbers>]}]}

- Answer every question, in order, in at most 3 plain sentences, using what was said on the call.
- "seq" lists the [number] of each transcript line the answer rests on. An answer with no line is not an answer.
- If the call does not answer a question, return "answer": "" and "seq": [] for it. Never guess or invent.
- Follow a question's instructions when it has them. Write for the rep and their manager, in plain words.`;

/** The questions as the model sees them. */
export function questionsBlock(sections: Section[]): string {
  return sections.map((s, i) => `${i + 1}. ${s.question}${s.instructions ? `\n   Instructions: ${s.instructions}` : ""}`).join("\n");
}

/**
 * The model's JSON → one answer per question, each resting on lines that exist, or NOT_DISCUSSED. Pure.
 * null when the reply isn't a usable answer list at all (cut off, not JSON, no answers): that is a failed read, never
 * "nothing was discussed" — it must not be stored (review 2026-11-26).
 */
export function parseAnswers(raw: string, sections: Section[], lines: Line[]): Answer[] | null {
  const seqs = new Set(lines.map((l) => l.seq));
  let items: unknown[] = [];
  try {
    const j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { answers?: unknown };
    if (!Array.isArray(j?.answers) || j.answers.length === 0) return null;
    items = j.answers;
  } catch {
    return null;
  }
  const byN = new Map<number, { answer: string; seqs: number[] }>();
  for (const x of items) {
    if (!x || typeof x !== "object") continue;
    const n = Number((x as { n?: unknown }).n);
    const answer = typeof (x as { answer?: unknown }).answer === "string" ? ((x as { answer: string }).answer).trim().slice(0, 600) : "";
    const cited = (Array.isArray((x as { seq?: unknown }).seq) ? ((x as { seq: unknown[] }).seq) : []).map(Number).filter((s) => Number.isInteger(s) && seqs.has(s));
    if (Number.isInteger(n) && n >= 1 && n <= sections.length && !byN.has(n)) byN.set(n, { answer, seqs: [...new Set(cited)].slice(0, 8) });
  }
  return sections.map((s, i) => {
    const a = byN.get(i + 1);
    return a && a.answer && a.seqs.length ? { question: s.question, answer: a.answer, seqs: a.seqs } : { question: s.question, answer: NOT_DISCUSSED, seqs: [] };
  });
}
