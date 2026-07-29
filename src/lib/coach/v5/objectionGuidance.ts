/**
 * Objection-guidance extraction (founder 2026-07-30).
 *
 * The client's rules for how the agent should respond when a prospect objects/rejects live in the
 * Coaching Methodology text. But both prompt paths truncate the methodology hard before injection
 * (live-cue 600 chars, role-play 4000), so objection rules placed anywhere but the very top get cut.
 *
 * This pulls the objection-relevant blocks OUT of the full methodology (computed before truncation) into
 * a compact, bounded block that both the live coach and role play inject verbatim — so the client's
 * objection rules reliably drive the agent's rejection behavior in BOTH modes, without bloating the whole
 * prompt with the entire methodology.
 *
 * Pure + bounded so it is unit-testable and its token cost is capped.
 */

const OBJECTION_CUES =
  /\b(objections?|rejections?|reject(?:ed|ing)?|push ?back|rebuttal|not interested|too expensive|no budget|think about it|maybe later|call (?:me )?back|already (?:have|with|got)|overcome|deflect|stall(?:s|ing)?|say(?:s|ing)? no|turn(?:s|ed)? down|hesitat|concern)\b/i;

/**
 * Extract the objection-handling portion of a methodology, bounded to `maxChars`.
 * Returns "" when the methodology has no objection-relevant content (then the general grounding stands).
 */
export function extractObjectionGuidance(
  methodology: string | null | undefined,
  maxChars = 800
): string {
  const src = methodology?.trim();
  if (!src) return "";

  // Split into blocks: blank-line paragraphs, then break before markdown list/heading markers so a
  // single objection line isn't buried inside one huge block.
  const blocks = src
    .split(/\n{2,}/)
    .flatMap((b) => b.split(/\n(?=\s*(?:[-*•]|#{1,6}\s|\d+[.)]\s))/))
    .map((b) => b.trim())
    .filter(Boolean);

  const relevant: string[] = [];
  let total = 0;
  for (const b of blocks) {
    if (!OBJECTION_CUES.test(b)) continue;
    relevant.push(b);
    total += b.length + 1;
    if (total >= maxChars) break;
  }
  if (relevant.length === 0) return "";

  let out = relevant.join("\n").trim();
  if (out.length > maxChars) out = out.slice(0, maxChars).trimEnd() + "…";
  return out;
}
