/**
 * Interaction stats from timed transcript segments (F9.3, F9.9, F10.1-F10.6).
 * Definitions follow Gong's published ones where they exist [OBSERVED, teardown M10];
 * docs/04-CONVERSATION-METRICS.md is the prose version. Gong's B2B benchmarks are NOT imported
 * as targets: remote sales norms for ELOSTATE clients must come from ELOSTATE's own data.
 */

import { ACKNOWLEDGEMENT_MAX_MS, INTERACTIVITY_CAP, INTERACTIVITY_WINDOW_MS } from './decisions';

export type Speaker = 'rep' | 'customer' | 'unknown';
export interface Segment { speaker: Speaker; startMs: number; endMs: number; text: string }

export interface InteractionStats {
  talkRatioTime: number | null; // rep share of known speech time, 0..1
  longestRepMonologueMs: number;
  longestCustomerStoryMs: number;
  interactivity: number | null; // 0..10
  patienceMs: number | null; // median pause before the rep answers the customer
  repQuestionsPerHour: number | null;
  speechMsBySpeaker: Record<Speaker, number>;
}

export class SegmentError extends Error {}

export function validateSegments(segments: Segment[]): Segment[] {
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
  for (const s of sorted) {
    if (!(s.endMs > s.startMs) || s.startMs < 0) {
      throw new SegmentError(`Segment ${s.startMs}-${s.endMs} has no positive duration`);
    }
  }
  return sorted;
}

const dur = (s: Segment) => s.endMs - s.startMs;

/** Talk-time lanes for the player: one list of [start,end] per speaker. */
export function talkTimeLanes(segments: Segment[]): Record<Speaker, [number, number][]> {
  const lanes: Record<Speaker, [number, number][]> = { rep: [], customer: [], unknown: [] };
  for (const s of validateSegments(segments)) lanes[s.speaker].push([s.startMs, s.endMs]);
  return lanes;
}

/** Stretches of one speaker with nobody else speaking in between. Pauses don't break a stretch. */
export function stretches(segments: Segment[]): { speaker: Speaker; ms: number }[] {
  const out: { speaker: Speaker; ms: number }[] = [];
  for (const s of validateSegments(segments)) {
    const last = out[out.length - 1];
    if (last && last.speaker === s.speaker) last.ms += dur(s);
    else out.push({ speaker: s.speaker, ms: dur(s) });
  }
  return out;
}

/** Same as stretches(), but very short utterances (an "mm-hm") don't interrupt the other speaker. */
function stretchesIgnoringAcks(segments: Segment[]): { speaker: Speaker; startMs: number }[] {
  const out: { speaker: Speaker; startMs: number }[] = [];
  for (const s of validateSegments(segments)) {
    if (s.speaker === 'unknown') continue;
    if (dur(s) <= ACKNOWLEDGEMENT_MAX_MS) continue;
    const last = out[out.length - 1];
    if (!last || last.speaker !== s.speaker) out.push({ speaker: s.speaker, startMs: s.startMs });
  }
  return out;
}

const QUESTION_OPENERS =
  /^(who|what|when|where|why|how|is|are|do|does|did|can|could|would|will|should|have|has|may)\b/i;

/** Same heuristic family as the live salesScore.ts:79 ('?' or an interrogative opener). */
export function isQuestion(text: string): boolean {
  const t = text.trim();
  return t.endsWith('?') || QUESTION_OPENERS.test(t);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function computeInteractionStats(input: Segment[]): InteractionStats {
  const segments = validateSegments(input);
  const speechMsBySpeaker: Record<Speaker, number> = { rep: 0, customer: 0, unknown: 0 };
  for (const s of segments) speechMsBySpeaker[s.speaker] += dur(s);

  const known = speechMsBySpeaker.rep + speechMsBySpeaker.customer;
  const talkRatioTime = known > 0 ? speechMsBySpeaker.rep / known : null;

  const st = stretches(segments);
  const longestRepMonologueMs = Math.max(0, ...st.filter((x) => x.speaker === 'rep').map((x) => x.ms));
  const longestCustomerStoryMs = Math.max(0, ...st.filter((x) => x.speaker === 'customer').map((x) => x.ms));

  // Interactivity: speaker switches (acks ignored) per 5-minute window, averaged, capped.
  let interactivity: number | null = null;
  const first = segments[0];
  const lastSeg = segments[segments.length - 1];
  if (first && lastSeg && speechMsBySpeaker.rep > 0 && speechMsBySpeaker.customer > 0) {
    const span = lastSeg.endMs - first.startMs;
    const windows = Math.max(1, Math.ceil(span / INTERACTIVITY_WINDOW_MS));
    const counts = new Array<number>(windows).fill(0);
    const turns = stretchesIgnoringAcks(segments);
    for (let i = 1; i < turns.length; i++) {
      const w = Math.min(windows - 1, Math.floor((turns[i]!.startMs - first.startMs) / INTERACTIVITY_WINDOW_MS));
      counts[w]! += 1;
    }
    const avg = counts.reduce((a, b) => a + b, 0) / windows;
    interactivity = Math.min(INTERACTIVITY_CAP, Math.round(avg * 10) / 10);
  }

  // Patience: gap between the customer finishing and the rep starting.
  const gaps: number[] = [];
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1]!;
    const cur = segments[i]!;
    if (prev.speaker === 'customer' && cur.speaker === 'rep') gaps.push(Math.max(0, cur.startMs - prev.endMs));
  }
  const patienceMs = median(gaps);

  // Questions per hour of session time (Gong scales to an hour; we keep the turn-share stat too).
  let repQuestionsPerHour: number | null = null;
  if (first && lastSeg) {
    const spanMs = lastSeg.endMs - first.startMs;
    const q = segments.filter((s) => s.speaker === 'rep' && isQuestion(s.text)).length;
    repQuestionsPerHour = spanMs > 0 ? Math.round((q / spanMs) * 3_600_000 * 10) / 10 : null;
  }

  return {
    talkRatioTime,
    longestRepMonologueMs,
    longestCustomerStoryMs,
    interactivity,
    patienceMs,
    repQuestionsPerHour,
    speechMsBySpeaker,
  };
}

/**
 * Stored transcript rows → timed segments (RSS Phase 2; founder picker 2026-11-15 "store them, estimate old
 * calls"). A row's start is its spoken_at minus the session start. Its end is its ended_at (0277) when stored;
 * otherwise ESTIMATED as the next line's start (or the audio's end, for the last line), so a pause counts as
 * the earlier speaker's talk — and `estimated` says so. A row with no time at all cannot be placed and is left
 * out, counted in `untimed`. Never throws; a row that would have no positive duration is left out too.
 */
export type TranscriptRow = {
  speaker: string;
  text: string;
  spoken_at?: string | null;
  ended_at?: string | null;
};

export function timedSegments(
  rows: readonly TranscriptRow[],
  sessionStartedAt: string | null,
  audioDurationSeconds: number | null
): { segments: Segment[]; estimated: boolean; untimed: number } {
  const base = sessionStartedAt ? Date.parse(sessionStartedAt) : NaN;
  const offset = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isFinite(t) && Number.isFinite(base) && t >= base ? t - base : null;
  };
  const placed = rows.map((r) => ({ r, startMs: offset(r.spoken_at), endMs: offset(r.ended_at) }));
  const audioEndMs = typeof audioDurationSeconds === 'number' && audioDurationSeconds > 0 ? audioDurationSeconds * 1000 : null;

  const segments: Segment[] = [];
  let estimated = false;
  let untimed = 0;
  placed.forEach((p, i) => {
    if (p.startMs === null) {
      untimed += 1;
      return;
    }
    let end = p.endMs !== null && p.endMs > p.startMs ? p.endMs : null;
    if (end === null) {
      const next = placed.slice(i + 1).find((q) => q.startMs !== null && q.startMs > p.startMs!);
      end = next ? next.startMs! : audioEndMs !== null && audioEndMs > p.startMs ? audioEndMs : null;
      if (end !== null) estimated = true;
    }
    if (end === null) {
      untimed += 1;
      return;
    }
    const speaker: Speaker = p.r.speaker === 'agent' ? 'rep' : p.r.speaker === 'customer' ? 'customer' : 'unknown';
    segments.push({ speaker, startMs: p.startMs, endMs: end, text: p.r.text });
  });
  return { segments, estimated, untimed };
}
