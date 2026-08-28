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

/**
 * Role-play FROM a recorded pitch (founder 2026-08-28): reconstruct the CUSTOMER from a rep's real recorded pitch
 * transcript so the rep can re-practice that exact conversation. The stored pitch transcript is a single
 * NON-diarized blob (rep + customer mixed), so the model must infer who said what — the same assumption the pitch
 * analyzer already makes. §3.4: the persona/objections must come from what the CUSTOMER actually said, never
 * invented, so the replay is faithful to that pitch; parse still returns null on empty so the caller falls back.
 */
export function buildPitchReplaySystemPrompt(corpus?: string): string {
  const grounding = corpus
    ? `\n\nThe rep's company / market, for realism (do not recite it):\n${corpus.slice(0, 2000)}`
    : "";
  return `You reconstruct a practice roleplay from a REAL recorded door-to-door sales pitch, so the rep can re-practice THAT EXACT conversation and improve. You are given the raw transcript of the call; the rep's and the customer's words are mixed together and NOT labeled, so infer which lines were the customer's.

Rebuild the CUSTOMER as a roleplay prospect the rep will pitch to again:
- persona: who this prospect is and their mood, drawn from how they actually spoke in the call.
- situation: the concrete setup AND the specific objections / hesitations / pushback THIS customer actually raised, so that when the rep re-pitches, the same resistance comes up again.

Rules:
- Base EVERYTHING on what the customer actually said or did in this transcript. Do NOT invent new objections or a different person; this is a replay of THIS pitch.
- NEVER name a skill, coach the rep, or say "this is practice". It must read as the real prospect and situation.
- Do NOT use em dashes or en dashes; write plainly.${grounding}

Return ONLY JSON in this exact shape:
{"title":"<3-6 word label for this prospect>","persona":"<who this prospect is, one short phrase>","situation":"<the setup plus the specific objections this customer raised, 2-3 sentences>"}`;
}

export function buildPitchReplayUserMessage(transcript: string, outcome?: string | null): string {
  const outcomeLine = outcome ? `\nHow the real call ended: ${outcome}.` : "";
  // Clamp the transcript so an unusually long call can't blow the token budget (the reconstruction needs the gist
  // of the customer's objections, not every word).
  const body = transcript.trim().slice(0, 6000);
  return `Here is the recorded pitch transcript (rep + customer mixed, not labeled):${outcomeLine}

${body}

Reconstruct the customer as a roleplay prospect per the rules. Return the JSON only.`;
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
