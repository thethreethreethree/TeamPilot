/**
 * Shared file-mention regex + parser.
 *
 * Format: @file[Title](UUID)
 *
 * Same shape as the existing @[Name](id) person-mention pattern
 * (per src/components/ui/MentionInput.tsx) but with a `@file`
 * prefix so the renderer can distinguish people from files in
 * the same render pass.
 *
 * The UUID is a v4 UUID — 36 chars with hyphens at the standard
 * positions. We enforce strict format so a typo doesn't render
 * as a chip (it'd be left as raw text instead).
 */

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Anchored regex — matches at the start of a string slice. Used
 *  by the inline markdown renderer that scans left-to-right. */
export const FILE_MENTION_INLINE = new RegExp(
  `^@file\\[([^\\]]+)\\]\\((${UUID_PATTERN})\\)`
);

/** Global regex — matches anywhere in a body. Used server-side
 *  to extract all cited file ids from a message body. */
export const FILE_MENTION_GLOBAL = new RegExp(
  `@file\\[([^\\]]+)\\]\\((${UUID_PATTERN})\\)`,
  "g"
);

export type FileMentionMatch = { title: string; fileId: string };

/** Extract every @file mention from a body. Returns unique fileIds. */
export function extractFileMentions(body: string | null): FileMentionMatch[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: FileMentionMatch[] = [];
  const re = new RegExp(FILE_MENTION_GLOBAL);
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const title = m[1] ?? "";
    const fileId = m[2] ?? "";
    if (!fileId || seen.has(fileId)) continue;
    seen.add(fileId);
    out.push({ title, fileId });
  }
  return out;
}

/** Build the marker text to insert into a textarea on autocomplete select. */
export function buildFileMention(args: {
  title: string;
  fileId: string;
}): string {
  // Strip brackets from title so it can never break the pattern.
  const safeTitle = args.title.replace(/[[\]]/g, "");
  return `@file[${safeTitle}](${args.fileId})`;
}

/** Detect whether the textarea cursor is currently inside a `@file<query>`
 *  trigger context. Returns the trigger start position (where `@`
 *  begins) and the current query (everything after `@file `). */
export function detectFileMentionContext(
  value: string,
  caret: number
): { triggerStart: number; query: string } | null {
  // Walk backward from the caret to find a `@file` token. Stop at
  // whitespace OR at start-of-string. The token has to be at a
  // word boundary (preceded by whitespace, newline, or start).
  let i = caret - 1;
  // Skip back past the query characters (any non-whitespace except
  // the closing of an existing mention).
  while (i >= 0) {
    const ch = value[i];
    if (!ch) break;
    if (/[\s\n]/.test(ch)) break;
    // Stop if we hit a `]` from a completed mention.
    if (ch === "]" || ch === ")") return null;
    i--;
  }
  // i now points to the char BEFORE the candidate token (or -1).
  const start = i + 1;
  const token = value.slice(start, caret);
  // Token must start with @file (case-sensitive — matches the
  // marker format).
  if (!token.startsWith("@file")) return null;
  // Per 2026-06-19 audit Finding #2: after `@file` the next char
  // (if any) MUST be a space. Without this guard, a user typing
  // `@filename.pdf` in plain text (mentioning a hypothetical file
  // by name, not as a marker) would wrongly trigger the
  // autocomplete with query "name.pdf". The trigger should only
  // fire when the user actually types `@file ` (with a space) or
  // `@file` at the cursor with nothing after.
  const afterFile = token.slice("@file".length);
  if (afterFile.length > 0 && !afterFile.startsWith(" ")) {
    return null;
  }
  // Boundary check — the character before `start` must be
  // whitespace, newline, or start-of-string.
  if (start > 0) {
    const prev = value[start - 1];
    if (prev && !/[\s\n]/.test(prev)) return null;
  }
  // Extract the query: everything after `@file` (skip one space if
  // present, so `@file foo` queries `foo`).
  let q = afterFile;
  if (q.startsWith(" ")) q = q.slice(1);
  return { triggerStart: start, query: q };
}
