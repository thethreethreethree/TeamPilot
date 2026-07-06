/**
 * Pure selection of a rep's "winning lines" from their followed-cue outcomes.
 * Extracted from salesCoach.getRepWinningLines (which is server-only with DB
 * deps) so the ranking/dedup/cap logic — including the audit's Fix C §3.5
 * discipline — is unit-testable and regression-pinned.
 *
 * Rules:
 *  - §3.5 (Fix C): REP-CONFIRMED ('rep_marked') follows rank above 'inferred'
 *    ones — a line the rep said they used beats one the system guessed. V8
 *    Array.sort is stable, so the caller's recency order holds within each group.
 *  - dedupe identical (capped) lines; cap for the prompt (latency).
 */
export function selectWinningLines(
  outcomes: ReadonlyArray<{ cue_id: string; source: string }>,
  textById: ReadonlyMap<string, string>,
  limit: number,
  maxLen = 140
): string[] {
  const ranked = [...outcomes].sort(
    (a, b) =>
      (a.source === "rep_marked" ? 0 : 1) - (b.source === "rep_marked" ? 0 : 1)
  );
  const cueIds: string[] = [];
  const seenId = new Set<string>();
  for (const o of ranked) {
    if (!seenId.has(o.cue_id)) {
      seenId.add(o.cue_id);
      cueIds.push(o.cue_id);
    }
  }
  const out: string[] = [];
  const seenLine = new Set<string>();
  for (const id of cueIds) {
    const t = textById.get(id);
    if (!t) continue;
    const line = t.slice(0, maxLen);
    if (seenLine.has(line)) continue;
    seenLine.add(line);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}
