import "server-only";

/**
 * Coaching materials library (founder 2026-08-27, pending item). For any skill a rep is working on, generate a short,
 * concrete coaching guide FROM the company's own methodology (corpus) — what good looks like, the key moves, what to
 * watch out for, and strong example lines. The rep reads it alongside the live practice. One guide per skill = a
 * library grounded in the team's own playbook, with no manual content management.
 *
 * §3.4: parse returns null on a malformed/empty response so the caller shows an honest "couldn't load" state, never a
 * fabricated guide. Grounded in the corpus so it teaches THIS team's method, not generic advice.
 */

export type CoachingMaterial = {
  overview: string; // 1-2 sentences: what this skill is and why it matters
  keyMoves: string[]; // 2-4 concrete things to do
  watchOuts: string[]; // 1-3 common mistakes
  exampleLines: string[]; // 1-3 strong phrasings the rep can adapt
};

export function buildMaterialSystemPrompt(corpus?: string): string {
  const grounding = corpus
    ? `\n\nTeach from THIS company's own sales methodology (do not contradict it, do not just recite it):\n${corpus.slice(0, 3500)}`
    : "";
  return `You are a sales coach writing a short, practical guide to ONE skill for a door-to-door rep to read before they practise it. Be concrete and specific to real doorstep conversations. No fluff, no filler, no praise padding. Write plainly and do not use em dashes or en dashes.${grounding}

Return ONLY JSON in this exact shape:
{
  "overview": "<1-2 sentences: what this skill is and why it wins on the doorstep>",
  "keyMoves": ["<a concrete thing to do>", "<another>"],
  "watchOuts": ["<a common mistake to avoid>"],
  "exampleLines": ["<a strong line the rep can adapt>"]
}

keyMoves holds 2-4 items, watchOuts 1-3, exampleLines 1-3. Keep each item short.`;
}

export function buildMaterialUserMessage(focus: string): string {
  return `Write the guide for this skill: "${focus}". Return the JSON only.`;
}

export function parseCoachingMaterial(text: string): CoachingMaterial | null {
  let parsed: unknown;
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const arr = (v: unknown, n: number) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((s) => s.trim()).slice(0, n)
      : [];
  const overview = str(o.overview);
  const keyMoves = arr(o.keyMoves, 4);
  const watchOuts = arr(o.watchOuts, 3);
  const exampleLines = arr(o.exampleLines, 3);
  // Nothing teachable → treat as empty (honest "couldn't load", not a blank shell).
  if (!overview && keyMoves.length === 0 && exampleLines.length === 0) return null;
  return { overview, keyMoves, watchOuts, exampleLines };
}
