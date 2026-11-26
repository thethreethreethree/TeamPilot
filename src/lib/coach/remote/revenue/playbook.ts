/**
 * Deal playbooks and the AI Deal Reviewer (revenue Phase 3b, 0373; Gong F20.6 methodology playbooks, F20.7 AI Deal
 * Reviewer). A company runs one playbook (MEDDICC, BANT, SPICED or its own); each element is a letter on every deal.
 *
 * A note on an element moves: empty → ai_found (the reviewer found evidence) → noted (a person wrote it) → validated (the
 * deal's owner or their manager confirmed it). Editing a validated note un-validates it. The REPLAY below is the
 * authority for a note's state: an action that isn't allowed from the state it lands on is ignored, so a race or a
 * stale screen can never put a note in a state the rules don't allow (§2.2: one place decides).
 *
 * HONESTY (the brief's discipline, briefTemplates.ts): the reviewer's evidence must cite transcript lines that exist on
 * the deal's calls; an element with no cited line is "not found on these calls", never a guess. Pure, so it is tested.
 */
export type Element = { letter: string; name: string; question: string };
export type PlaybookKey = "meddicc" | "bant" | "spiced" | "custom";

export const PLAYBOOKS: Record<Exclude<PlaybookKey, "custom">, { name: string; elements: Element[] }> = {
  meddicc: {
    name: "MEDDICC",
    elements: [
      { letter: "M", name: "Metrics", question: "What measurable result does the customer expect, in their numbers?" },
      { letter: "E", name: "Economic buyer", question: "Who holds the budget and makes the final call, and have we spoken with them?" },
      { letter: "D", name: "Decision criteria", question: "What will they judge the options on?" },
      { letter: "D", name: "Decision process", question: "What steps, people and dates stand between now and a signed deal?" },
      { letter: "I", name: "Identified pain", question: "What problem is driving this, and what does it cost them today?" },
      { letter: "C", name: "Champion", question: "Who inside is selling this for us, and why do they care?" },
      { letter: "C", name: "Competition", question: "Who or what else are they considering, including doing nothing?" },
    ],
  },
  bant: {
    name: "BANT",
    elements: [
      { letter: "B", name: "Budget", question: "Is there money for this, and how much?" },
      { letter: "A", name: "Authority", question: "Who decides, and are they involved?" },
      { letter: "N", name: "Need", question: "What do they need, in their words?" },
      { letter: "T", name: "Timeline", question: "When do they want it in place, and why then?" },
    ],
  },
  spiced: {
    name: "SPICED",
    elements: [
      { letter: "S", name: "Situation", question: "What is their situation today: team, tools, process?" },
      { letter: "P", name: "Pain", question: "What is hurting, in their words?" },
      { letter: "I", name: "Impact", question: "What does that pain cost them, or what would fixing it gain?" },
      { letter: "CE", name: "Critical event", question: "What date or event makes this urgent?" },
      { letter: "D", name: "Decision", question: "How will they decide, and who is involved?" },
    ],
  },
};

export const MAX_ELEMENTS = 10;
export const NOTE_MAX = 1000;
export const NOT_FOUND = "Not found on this deal's calls.";

/** A custom playbook's elements, checked. Returns an error sentence or the elements. */
export function parseElements(raw: unknown): { ok: true; elements: Element[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Add at least one element." };
  if (raw.length > MAX_ELEMENTS) return { ok: false, error: `A playbook has at most ${MAX_ELEMENTS} elements.` };
  const out: Element[] = [];
  for (const [i, r] of raw.entries()) {
    const o = (r ?? {}) as Record<string, unknown>;
    const letter = typeof o.letter === "string" ? o.letter.trim().toUpperCase() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const question = typeof o.question === "string" ? o.question.trim() : "";
    if (!/^[A-Z0-9]{1,3}$/.test(letter)) return { ok: false, error: `Element ${i + 1} needs a short label: 1–3 letters or digits.` };
    if (!name || name.length > 40) return { ok: false, error: `Element ${i + 1} needs a name of 1–40 characters.` };
    if (!question || question.length > 200) return { ok: false, error: `Element ${i + 1} needs a question of 1–200 characters.` };
    out.push({ letter, name, question });
  }
  return { ok: true, elements: out };
}

// ── Note states ────────────────────────────────────────────────────────────────────────────────────────────────────
export type NoteState = "empty" | "ai_found" | "noted" | "validated";
export type NoteAction = "ai_suggest" | "write" | "validate" | "clear";
export type Cite = { sessionId: string; seq: number; atMs?: number | null };
export type AiRead = { answer: string; cites: Cite[] };

const NEXT: Record<NoteState, Partial<Record<NoteAction, NoteState>>> = {
  empty: { ai_suggest: "ai_found", write: "noted" },
  ai_found: { ai_suggest: "ai_found", write: "noted", clear: "empty" },
  noted: { ai_suggest: "noted", write: "noted", validate: "validated", clear: "empty" },
  validated: { ai_suggest: "validated", write: "noted", clear: "empty" },
};

/** Whether `action` is allowed on a note in `state`. Validation needs a written note; an AI read never overwrites one. */
export function allowed(state: NoteState, action: NoteAction): boolean {
  return NEXT[state][action] !== undefined;
}

export type NoteEvent = { element: number; action: NoteAction; note: string | null; ai: AiRead | null; actorId: string; at: string };
export type NoteView = { element: number; state: NoteState; note: string | null; ai: AiRead | null; validatedBy: string | null; at: string | null };

/**
 * Replay a deal's note events (oldest first) into each element's current note. An event not allowed from the state it
 * lands on is ignored. An AI read is kept beside a person's note (shown as the evidence), never replacing it.
 */
export function replayNotes(events: NoteEvent[], elementCount: number): NoteView[] {
  const out: NoteView[] = Array.from({ length: elementCount }, (_, i) => ({ element: i, state: "empty" as NoteState, note: null, ai: null, validatedBy: null, at: null }));
  for (const e of events) {
    const v = out[e.element];
    if (!v || !allowed(v.state, e.action)) continue;
    v.state = NEXT[v.state][e.action]!;
    v.at = e.at;
    if (e.action === "ai_suggest") v.ai = e.ai;
    else if (e.action === "write") {
      v.note = e.note;
      v.validatedBy = null;
    } else if (e.action === "validate") v.validatedBy = e.actorId;
    else if (e.action === "clear") {
      v.note = null;
      v.ai = null;
      v.validatedBy = null;
    }
  }
  return out;
}

// ── The reviewer ───────────────────────────────────────────────────────────────────────────────────────────────────
export const DEAL_REVIEW_SYSTEM = `You review a sales deal against the team's playbook, using only the transcripts of the deal's calls. Answer as JSON only.

Return exactly: {"elements": [{"n": <element number>, "answer": "...", "cites": [{"call": <call number>, "seq": <line number>}]}]}

- For every element, in order: what the calls show about it, in at most 2 plain sentences a rep can paste as a note.
- "cites" lists each transcript line the answer rests on: the call's number (C1, C2, ... as given) and the line's [number].
  An answer with no line is not an answer.
- If the calls don't show an element, return "answer": "" and "cites": [] for it. Never guess, assume or invent.
- Write for the rep and their manager. No preamble.`;

export type CallLines = { sessionId: string; startedAt: string; lines: Array<{ seq: number; speaker: string; text: string; atMs: number | null }> };

/** A deal's calls as the model sees them: C1, C2, ... newest first. Every AI read over a deal numbers calls this way. */
export function callsBlock(calls: CallLines[], numbered: (lines: CallLines["lines"]) => string): string {
  return calls.map((c, i) => `=== C${i + 1} · call on ${c.startedAt.slice(0, 10)} ===\n${numbered(c.lines)}`).join("\n\n");
}

/** The elements and the calls, as the model sees them. */
export function reviewPrompt(elements: Element[], calls: CallLines[], numbered: (lines: CallLines["lines"]) => string): string {
  const els = elements.map((e, i) => `${i + 1}. ${e.name} (${e.letter}): ${e.question}`).join("\n");
  return `Playbook elements:\n${els}\n\nCalls:\n${callsBlock(calls, numbered)}`;
}

/**
 * The model's JSON → one read per element, each resting on lines that exist on the calls given, or NOT_FOUND. null when
 * the reply isn't a usable list at all (cut off, not JSON, empty): a failed read, never "nothing found", and not stored.
 */
export function parseReview(raw: string, elements: Element[], calls: CallLines[]): AiRead[] | null {
  let items: unknown[];
  try {
    const j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { elements?: unknown };
    if (!Array.isArray(j?.elements) || j.elements.length === 0) return null;
    items = j.elements;
  } catch {
    return null;
  }
  const lineAt = calls.map((c) => new Map(c.lines.map((l) => [l.seq, l.atMs])));
  const byN = new Map<number, AiRead>();
  for (const x of items) {
    if (!x || typeof x !== "object") continue;
    const o = x as { n?: unknown; answer?: unknown; cites?: unknown };
    const n = Number(o.n);
    if (!Number.isInteger(n) || n < 1 || n > elements.length || byN.has(n)) continue;
    const answer = typeof o.answer === "string" ? o.answer.trim().slice(0, 600) : "";
    const cites: Cite[] = [];
    for (const c of Array.isArray(o.cites) ? o.cites : []) {
      const callN = Number(String((c as { call?: unknown })?.call ?? "").replace(/^C/i, ""));
      const seq = Number((c as { seq?: unknown })?.seq);
      const call = calls[callN - 1];
      if (!call || !Number.isInteger(seq) || !lineAt[callN - 1]!.has(seq)) continue;
      if (!cites.some((k) => k.sessionId === call.sessionId && k.seq === seq)) cites.push({ sessionId: call.sessionId, seq, atMs: lineAt[callN - 1]!.get(seq) ?? null });
    }
    byN.set(n, { answer, cites: cites.slice(0, 6) });
  }
  return elements.map((_, i) => {
    const r = byN.get(i + 1);
    return r && r.answer && r.cites.length ? r : { answer: NOT_FOUND, cites: [] };
  });
}

/** How many of the deal's most recent calls the reviewer reads, and the line budget across them. */
export const REVIEW_CALLS = 5;
export const REVIEW_LINES = 900;
