/**
 * Names for a call's two speakers (0343; Gong ledger F8.5). Rows are append-only; the latest per speaker wins and an
 * empty name clears it. Pure.
 */
export type SpeakerSide = "rep" | "customer";
export type SpeakerNames = Partial<Record<SpeakerSide, string>>;

/** Rows newest first OR in any order (by id): the highest id per speaker wins. */
export function latestSpeakerNames(rows: Array<{ id: number; speaker: string; name: string }>): SpeakerNames {
  const best = new Map<string, { id: number; name: string }>();
  for (const r of rows) {
    if (r.speaker !== "rep" && r.speaker !== "customer") continue;
    const had = best.get(r.speaker);
    if (!had || r.id > had.id) best.set(r.speaker, { id: r.id, name: r.name });
  }
  const out: SpeakerNames = {};
  for (const [k, v] of best) if (v.name.trim()) out[k as SpeakerSide] = v.name.trim();
  return out;
}

/** A name as stored: trimmed, single-spaced, at most 60 characters. */
export const cleanSpeakerName = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 60);
