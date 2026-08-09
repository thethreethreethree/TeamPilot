import "server-only";

/**
 * Shared output format for the Sales Coach "Suggested Response" engines (co-pilot + formulate).
 *
 * WHY this is one module (§A21 one mechanism): both engines produce the SAME two-part output — the sendable
 * reply, then a one-line naming of the sales MOVE (the "why", for the rep's learning). They MUST format it
 * identically so a single streaming reader can split them the same way regardless of which engine ran. Before
 * this module, co-pilot used the `===REASONING===` marker while formulate returned STRICT JSON — which cannot
 * be streamed to a human (they'd watch `{"reply":"Hi ther…` form). Unifying both on the marker lets the reply
 * stream cleanly (everything before the marker is the forming reply) and the move arrive at the end.
 *
 * This is a FORMAT change only — the reply CONTENT each engine produces is unchanged (founder 2026-08-09: no
 * quality sacrifice for speed). Only the delimiter around it changed, from JSON to a marker.
 */

/** Sentinel the model emits between the reply and the move-naming line. Distinctive so it can't collide with
 *  ordinary reply text. */
export const REASONING_MARKER = "===REASONING===";

/**
 * Shared VOICE + PUNCTUATION rule for both Suggested Response engines (founder 2026-08-09). Three asks: (1) the
 * drafted reply must be CHARISMATIC — the founder's core note: what makes a great rep is charisma, and the
 * coach's drafts must carry that personality; (2) natural, warm, a little playful, never stiff or AI-flat,
 * while staying genuinely professional; (3) NO em/en dashes or "---", which read as AI-written and are the tell
 * the founder flagged on a live draft. One source so co-pilot and formulate can't drift apart on voice. This
 * shapes only the tone + punctuation of the SAME message the engine already produces, not what it says.
 */
export function salesVoiceRule(): string {
  return `VOICE — this is the most important thing: write with CHARISMA. The best salespeople win because they are magnetic — warm, confident, genuinely engaging, and they make the other person feel good in the conversation. Every drafted message must carry that personality. Be personable and a little playful when it fits, with real charm and easy confidence. Stay professional and sharp underneath; charisma is warmth plus confidence, never fake hype or pushy salesiness. Light humor is welcome when it lands naturally, but never force a joke and never at the prospect's expense. Use contractions (you're, I'm, let's). Sound like the most likeable, magnetic rep the prospect has ever talked to — the kind of person they actually enjoy replying to.

PUNCTUATION — do NOT use em dashes or en dashes ("—", "–") or triple dashes ("---"); they read as AI-written. Use a comma, a period, or just start a new sentence instead. Keep it clean and human.`;
}

/**
 * The system-prompt instruction telling the model to emit the reply, then the marker, then ONE short line
 * naming the move. Shared by both engines so the streaming reader's split contract has a single source.
 */
export function reasoningInstruction(): string {
  return `Then, on a new line, output the marker ${REASONING_MARKER} followed by ONE short line naming the sales MOVE you used (e.g. "labeled the objection", "asked a SPIN implication question", "traded a small concession for a commitment") — for the rep's learning, not for the prospect. Output the reply FIRST, the marker and move LAST.`;
}

/**
 * Split the model output into the sendable reply and its one-line move-naming reasoning. Pure + exported so
 * the split (and the marker-first / no-marker edge cases) is unit-tested directly, and so the streaming reader
 * and the non-streaming engines split identically. No marker → the whole output is the reply (never errors the
 * rep out over formatting); the route then guards an empty reply.
 */
export function splitReplyReasoning(raw: string): { reply: string; reasoning: string } {
  const idx = raw.indexOf(REASONING_MARKER);
  const reply = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const reasoning = idx >= 0 ? raw.slice(idx + REASONING_MARKER.length).trim() : "";
  return { reply, reasoning };
}

/**
 * Deterministic safety net for the no-em-dash rule (founder 2026-08-09: "make sure our response does not have
 * --- character"). The VOICE prompt asks the model to avoid them, but a prompt is best-effort — this GUARANTEES
 * it. Targets ONLY the AI-tell dashes: em "—", en "–", and runs of "--"/"---". A normal hyphen ("day-to-day",
 * "555-1234") is legitimate and left untouched. A spaced dash used as a pause reads naturally as a comma, so
 * that's the substitution; the follow-up cleanups undo any awkward ", ." / " ," / ",," the swap can create.
 */
export function stripAiDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*-{2,}\s*/g, ", ") // "--" / "---" → comma
    .replace(/\s*[—–]\s*/g, ", ") // em / en dash → comma
    .replace(/([.!?])\s*,\s*/g, "$1 ") // ". ," → ". "
    .replace(/\s+,/g, ",") // " ," → ","
    .replace(/,\s*,/g, ", ") // ",," → ", "
    .replace(/,\s*([.!?])/g, "$1") // ", ." → "."
    .replace(/[ \t]{2,}/g, " ") // collapse doubled spaces the swaps can leave
    .trim();
}

/**
 * Split AND sanitize — the finalization both deliveries use so the reply the rep sees/copies is dash-clean.
 * splitReplyReasoning stays pure (raw split) for the streaming reader's progressive view; this is the final
 * form. Applied server-side at the non-stream engine return and the stream's done event.
 */
export function finalizeSuggestion(raw: string): { reply: string; reasoning: string } {
  const { reply, reasoning } = splitReplyReasoning(raw);
  return { reply: stripAiDashes(reply), reasoning: stripAiDashes(reasoning) };
}
