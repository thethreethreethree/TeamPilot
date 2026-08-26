import "server-only";

/**
 * AI-written practice scenarios (founder 2026-08-27, pending item). When a rep practises a specific focus, instead of a
 * generic persona we generate ONE concrete, realistic door-to-door prospect scenario that naturally forces them to use
 * that skill — grounded in the company's own market (corpus). The rep can regenerate for a different one.
 *
 * §3.4: parse returns null on a malformed/empty LLM response so the caller can fall back to the plain focus seed (never
 * a fabricated or blank scenario). The scenario NEVER names the skill or says "this is practice" — that would let the
 * prospect break character.
 */

export type PracticeScenario = {
  title: string; // short label, e.g. "The burned homeowner"
  persona: string; // who's at the door, e.g. "Guarded homeowner, mid-40s, just got home from work"
  situation: string; // 1-2 sentences of concrete context that will test the skill
};

export function buildScenarioSystemPrompt(corpus?: string): string {
  const grounding = corpus
    ? `\n\nGround the scenario in this company's market so it feels real; do not recite it:\n${corpus.slice(0, 3000)}`
    : "";
  return `You design realistic practice scenarios for a door-to-door sales rep. Given ONE skill the rep needs to work on, invent a single concrete, believable prospect scenario that naturally forces them to use that skill during the conversation.

Rules:
- Make it specific and realistic: who the prospect is, their mood, what just happened, why this moment tests the skill.
- NEVER name the skill, coach the rep, or hint that this is a practice. It must read as a real situation.
- Do NOT use em dashes or en dashes; write plainly.${grounding}

Return ONLY JSON in this exact shape:
{"title":"<3-6 word label>","persona":"<who is at the door, one short phrase>","situation":"<1-2 sentences of concrete context that will test the skill>"}`;
}

export function buildScenarioUserMessage(focus: string): string {
  return `The rep needs to practise this skill: "${focus}". Write one realistic prospect scenario that will naturally test it. Return the JSON only.`;
}

export function parsePracticeScenario(text: string): PracticeScenario | null {
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
  const title = str(o.title);
  const persona = str(o.persona);
  const situation = str(o.situation);
  // A scenario with no persona AND no situation carries nothing usable — treat as empty (fall back to the plain seed).
  if (!persona && !situation) return null;
  return { title, persona, situation };
}
