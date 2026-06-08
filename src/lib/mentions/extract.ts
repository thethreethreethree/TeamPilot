/**
 * Mention parsing — shared between client (rendering) and server
 * (chain-event emission). Mentions are stored inline in body text using
 * markdown-link syntax so we keep both the display name (resolved at
 * mention-time) and a stable user_id reference:
 *
 *   `Hey @[Moses Maniquiz](7da30c76-…) what do you think?`
 *
 * Why this format:
 *   - Plain `@Moses` is fragile — renaming the user later breaks the
 *     reference, and we can't tell two people named Moses apart.
 *   - A separate `mentions` JSON column would split the truth: the
 *     text wouldn't render right without the side table.
 *   - This format is git-blame-able, plain-text-readable, and parses
 *     with one regex on either side of the wire.
 */

// Strict regex: name in [...], UUID in (...). The UUID shape rules
// out accidental matches against arbitrary parenthesized text.
const MENTION_RE =
  /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export type ExtractedMention = {
  userId: string;
  displayName: string;
};

/**
 * Pull every unique mention out of a body of text. Same user mentioned
 * twice in the same body returns once — one chain event per (source,
 * target) pair is plenty; multiple events would be noise.
 */
export function extractMentions(text: string): ExtractedMention[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: ExtractedMention[] = [];
  for (const m of text.matchAll(MENTION_RE)) {
    // Captures are guaranteed by the regex shape but
    // noUncheckedIndexedAccess types them as `string | undefined`.
    const displayName = m[1];
    const userId = m[2]?.toLowerCase();
    if (!displayName || !userId) continue;
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ userId, displayName });
  }
  return out;
}

/**
 * Take the raw text containing `@[name](uuid)` markers and return a
 * sequence of plain-text and mention segments so a renderer can map
 * them to React nodes without re-running the regex.
 */
export type MentionSegment =
  | { type: "text"; text: string }
  | { type: "mention"; displayName: string; userId: string };

export function tokenizeMentions(text: string): MentionSegment[] {
  if (!text) return [];
  const out: MentionSegment[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const displayName = m[1];
    const userId = m[2]?.toLowerCase();
    if (!displayName || !userId) continue;
    const start = m.index ?? 0;
    if (start > lastIndex) {
      out.push({ type: "text", text: text.slice(lastIndex, start) });
    }
    out.push({ type: "mention", displayName, userId });
    lastIndex = start + m[0].length;
  }
  if (lastIndex < text.length) {
    out.push({ type: "text", text: text.slice(lastIndex) });
  }
  return out;
}

/**
 * Strip mention markup back to plain `@DisplayName` form. Useful for
 * excerpts going into chain events — we don't need to leak UUIDs into
 * the audit trail's `excerpt` field; the structured `target_user_id`
 * already carries that.
 */
export function stripMentionMarkup(text: string): string {
  if (!text) return "";
  return text.replace(MENTION_RE, (_full, name) => `@${name}`);
}
