/** F11.1 - keyword trackers: a per-company phrase list matched after transcription. */

// The fields matching needs. Defined here rather than imported from stats.ts (Phase 2, not built: it needs
// segment end times the transcript does not store). `startMs` is null when a segment has no wall clock.
export type Speaker = 'rep' | 'customer' | 'unknown';
export interface Segment { speaker: Speaker; startMs: number | null; text: string; seq?: number }

/** `within_first_seconds` (0335): count only lines said in the first N seconds of the call; null/absent = the whole call. */
export interface KeywordTracker { id: string; name: string; phrases: string[]; side: 'rep' | 'customer' | 'any'; within_first_seconds?: number | null; starts_on?: string | null; ends_on?: string | null; channels?: string[] | null }

/**
 * Whether a tracker counts on a call that started at `callStartIso` (0344, F11.5): on or after its start date, and no
 * later than the end of its end date (UTC calendar days, as stored); and (0361) of one of its call types, when it has
 * any. No dates → always. A call with no known start can't
 * be placed, so a dated tracker leaves it out.
 */
export function trackerAppliesTo(t: { starts_on?: string | null; ends_on?: string | null; channels?: string[] | null }, callStartIso: string | null | undefined, channel?: string | null): boolean {
  // 0361 (F11.3): a tracker limited to call types counts only on those. A call of unknown type can't be placed.
  if (t.channels && t.channels.length && (!channel || !t.channels.includes(channel))) return false;
  if (!t.starts_on && !t.ends_on) return true;
  const at = callStartIso ? Date.parse(callStartIso) : NaN;
  if (!Number.isFinite(at)) return false;
  if (t.starts_on && at < Date.parse(`${t.starts_on}T00:00:00Z`)) return false;
  if (t.ends_on && at >= Date.parse(`${t.ends_on}T00:00:00Z`) + 86_400_000) return false;
  return true;
}

/** Whether a line at `startMs` is inside the tracker's window. No window → always. A line with no time can't be placed. */
export function inWindow(withinFirstSeconds: number | null | undefined, startMs: number | null): boolean {
  if (withinFirstSeconds == null) return true;
  return startMs !== null && startMs <= withinFirstSeconds * 1000;
}
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
    if (!inWindow(tracker.within_first_seconds, s.startMs)) continue;
    for (const { p, re } of res) if (re.test(s.text)) hits.push({ trackerId: tracker.id, atMs: s.startMs, speaker: s.speaker, matched: p, ...(s.seq !== undefined ? { seq: s.seq } : {}) });
  }
  return hits;
}

/**
 * F11.4 — preview a tracker against recent calls BEFORE saving it. The same matcher the real scan uses (matchTracker),
 * so what the preview shows is what the tracker will catch. Per-phrase counts make a noisy phrase visible ("price"
 * hitting every call) before it floods the call pages. Pure; nothing is stored.
 */
export interface PreviewCall { sessionId: string; label: string | null; startedAt: string; segments: Segment[] }
export interface TrackerPreview {
  callsChecked: number;
  callsWithHits: number;
  hitCount: number;
  perPhrase: Array<{ phrase: string; hits: number; calls: number }>;
  examples: Array<{ sessionId: string; label: string | null; startedAt: string; atMs: number | null; speaker: Speaker; matched: string; text: string }>;
}

export function previewTracker(tracker: Omit<KeywordTracker, 'id'>, calls: PreviewCall[], maxExamples = 8): TrackerPreview {
  const t: KeywordTracker = { id: 'preview', ...tracker };
  const phrases = normalisePhrases(tracker.phrases); // throws TrackerError on a bad list, same as saving would
  const perPhrase = new Map(phrases.map((p) => [p, { hits: 0, calls: new Set<string>() }]));
  const examples: TrackerPreview['examples'] = [];
  let callsWithHits = 0;
  let hitCount = 0;
  for (const c of calls) {
    const hits = matchTracker(t, c.segments);
    if (hits.length) callsWithHits += 1;
    hitCount += hits.length;
    for (const h of hits) {
      const pp = perPhrase.get(h.matched);
      if (pp) {
        pp.hits += 1;
        pp.calls.add(c.sessionId);
      }
      // One example per call first, so a single chatty call doesn't fill the list.
      if (examples.length < maxExamples && !examples.some((e) => e.sessionId === c.sessionId)) {
        const seg = c.segments.find((s) => s.seq === h.seq) ?? c.segments.find((s) => s.startMs === h.atMs);
        examples.push({ sessionId: c.sessionId, label: c.label, startedAt: c.startedAt, atMs: h.atMs, speaker: h.speaker, matched: h.matched, text: (seg?.text ?? '').slice(0, 220) });
      }
    }
  }
  return {
    callsChecked: calls.length,
    callsWithHits,
    hitCount,
    perPhrase: [...perPhrase.entries()].map(([phrase, v]) => ({ phrase, hits: v.hits, calls: v.calls.size })).sort((a, b) => b.hits - a.hits),
    examples,
  };
}
