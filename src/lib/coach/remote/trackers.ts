/** F11.1 - keyword trackers: a per-company phrase list matched after transcription. */

// The fields matching needs. Defined here rather than imported from stats.ts (Phase 2, not built: it needs
// segment end times the transcript does not store). `startMs` is null when a segment has no wall clock.
export type Speaker = 'rep' | 'customer' | 'unknown';
export interface Segment { speaker: Speaker; startMs: number | null; text: string; seq?: number }

export interface KeywordTracker { id: string; name: string; phrases: string[]; side: 'rep' | 'customer' | 'any' }
export interface TrackerHit { trackerId: string; atMs: number | null; speaker: Speaker; matched: string; seq?: number }

export class TrackerError extends Error {}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalisePhrases(phrases: string[]): string[] {
  const out = [...new Set(phrases.map((p) => p.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];
  if (out.length === 0) throw new TrackerError('A tracker needs at least one phrase');
  if (out.length > 200) throw new TrackerError('A tracker holds up to 200 phrases');
  for (const p of out) if (p.length < 2) throw new TrackerError(`Phrase "${p}" is too short to match reliably`);
  return out;
}

/** Whole-word, case-insensitive. One hit per phrase per segment. */
export function matchTracker(tracker: KeywordTracker, segments: Segment[]): TrackerHit[] {
  const phrases = normalisePhrases(tracker.phrases);
  const res = phrases.map((p) => ({ p, re: new RegExp(`(^|[^\\p{L}\\p{N}])${escape(p).replace(/ /g, '\\s+')}($|[^\\p{L}\\p{N}])`, 'iu') }));
  const hits: TrackerHit[] = [];
  for (const s of segments) {
    if (tracker.side !== 'any' && s.speaker !== tracker.side) continue;
    for (const { p, re } of res) if (re.test(s.text)) hits.push({ trackerId: tracker.id, atMs: s.startMs, speaker: s.speaker, matched: p, ...(s.seq !== undefined ? { seq: s.seq } : {}) });
  }
  return hits;
}
