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
  // BUG FIX (2026-07-22): the previous implementation walked backward and STOPPED at the first whitespace,
  // so the space in "@file <query>" ended the token before "@file" was recognized — the query was ALWAYS
  // empty and the search-as-you-type never worked (contradicting this function's own comments). We instead
  // anchor on the last "@file" before the caret and read the query forward from there.
  const head = value.slice(0, caret);
  const idx = head.lastIndexOf("@file");
  if (idx < 0) return null;

  // Word boundary: the char before `@file` must be whitespace/newline or start-of-string. Rules out
  // "email@file" and similar.
  if (idx > 0) {
    const prev = value[idx - 1];
    if (prev && !/[\s\n]/.test(prev)) return null;
  }

  const afterFile = head.slice(idx + "@file".length);
  // Per 2026-06-19 audit Finding #2: if there IS text right after `@file`, it must begin with a space —
  // otherwise a plain word like `@filename.pdf` would wrongly trigger the autocomplete.
  if (afterFile.length > 0 && !afterFile.startsWith(" ")) return null;

  // The query is the single token after `@file ` (skip the one leading space). A further space/newline or a
  // mention-closer (`]`/`)`) ends the mention, so those never appear inside the live query.
  const q = afterFile.startsWith(" ") ? afterFile.slice(1) : "";
  if (/[\s\n\]\)]/.test(q)) return null;

  return { triggerStart: idx, query: q };
}
