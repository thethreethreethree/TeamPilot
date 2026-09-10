/**
 * What a transcript line's speaker is CALLED on screen.
 *
 * THE DEFECT THIS ENDS. The session page rendered `{seg.speaker}` directly — the raw
 * database value, uppercased by CSS. So a transcript read `AGENT` and `CUSTOMER`, and from
 * 10 September 2026, when recovery began saving a dropped call's words before anyone had
 * attributed them, it read **`UNKNOWN`** above every single line.
 *
 * That word is the problem. `unknown` is an honest internal state — nobody has told us which
 * voice is the rep yet — but printed at a rep it reads as a verdict on their call, or as an
 * error. It is the same failure the rest of this product spends real effort avoiding: an
 * absence presented as a measurement. The phone already got this right and says
 * "Unattributed"; the website was showing the column.
 *
 * WHY NOT "You", WHICH IS WHAT THE PHONE SAYS. The phone is in the rep's hand, so "You" is
 * true there. This page has no idea who is looking — a manager can open a rep's call — so
 * "You" would be a claim it cannot support, and telling a manager that the rep's words are
 * theirs is worse than the mild inconsistency of two nouns. "Rep" is true for every viewer.
 *
 * NOT the same function as `speakerLabel` in coach/strategy/renderTurns.ts, and deliberately
 * so. That one renders speakers INTO AN LLM PROMPT for multi-party meetings, where the
 * audience is a model, the speaker is a participant name rather than a role, and shouting
 * UNKNOWN is the correct signal. Reusing it here would have put prompt vocabulary on a
 * rep's screen.
 */

/** The three speakers a sales transcript can carry (`coaching_transcript_segments.speaker`). */
export type TranscriptSpeakerValue = "agent" | "customer" | "unknown" | (string & {});

/**
 * The on-screen name for a transcript speaker.
 *
 * ANY unrecognised value falls to "Unattributed" rather than being printed. A speaker this
 * code does not know about is precisely the case where showing the raw column would leak a
 * new internal state onto a rep's screen — which is how `UNKNOWN` got there in the first
 * place.
 */
export function speakerName(speaker: TranscriptSpeakerValue | null | undefined): string {
  if (speaker === "agent") return "Rep";
  if (speaker === "customer") return "Customer";
  return "Unattributed";
}

/**
 * True when this line has never been attributed, so a screen can explain itself once rather
 * than repeating the word down the page.
 */
export function isUnattributed(speaker: TranscriptSpeakerValue | null | undefined): boolean {
  return speaker !== "agent" && speaker !== "customer";
}
