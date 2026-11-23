/**
 * Editable transcripts (2026-11-23; migration 0311). Which lines of the CURRENT transcript show an "edited" mark, and
 * what they said before the first correction. Pure, so the rule is tested.
 *
 * A mark is shown only while the line still holds the latest correction's words: if the call was re-transcribed
 * later (new lines at the same numbers), the old edit no longer describes the line and no mark is shown.
 */
export type EditRow = { seq: number; from_version: number; to_version: number; edited_by: string; created_at: string };
export type EditMark = { seq: number; original: string; editedAt: string; editedBy: string; count: number };

export function editMarks(edits: EditRow[], textAt: (version: number, seq: number) => string | undefined, current: Map<number, string>): EditMark[] {
  const bySeq = new Map<number, EditRow[]>();
  for (const e of [...edits].sort((a, b) => a.to_version - b.to_version)) bySeq.set(e.seq, [...(bySeq.get(e.seq) ?? []), e]);
  const out: EditMark[] = [];
  for (const [seq, list] of bySeq) {
    const first = list[0]!;
    const last = list[list.length - 1]!;
    const now = current.get(seq);
    const original = textAt(first.from_version, seq);
    if (now === undefined || original === undefined || textAt(last.to_version, seq) !== now || original === now) continue;
    out.push({ seq, original, editedAt: last.created_at, editedBy: last.edited_by, count: list.length });
  }
  return out.sort((a, b) => a.seq - b.seq);
}

/** A corrected line: trimmed of outer whitespace, 1-4000 characters (the database refuses anything else too). */
export function cleanLine(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= 4000 ? t : null;
}
