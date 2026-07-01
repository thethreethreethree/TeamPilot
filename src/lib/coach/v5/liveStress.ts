/**
 * Live Sales Coach — MEASURABLE stress signals (build 3). No tone/pitch audio
 * analysis (founder 2026-07-01): derive the "same ideal result" from what is
 * actually measurable in the live transcript + timing.
 *
 *   - Filler density: EXACT + textual — the share of a rep turn that is filler
 *     ("um", "uh", "like", "you know"). A spike reads as nerves/uncertainty.
 *   - Pace spike: the rep's words-per-minute for a turn vs their OWN rolling
 *     baseline. A sudden jump reads as rushing. Pace is APPROXIMATE — it uses
 *     wall-clock utterance duration, not word-level timestamps (§3.4).
 *
 * Pure + deterministic (§3.5 — measurement is the honest moat; these are
 * verifiable without an LLM). Client passes the results to the cue brain as a
 * hint; the brain still decides whether a steadying nudge is warranted (§3.3).
 */

// Common English fillers/hedges. Multi-word entries are matched as phrases.
const FILLERS = [
  "um",
  "uh",
  "erm",
  "er",
  "like",
  "you know",
  "i mean",
  "kind of",
  "sort of",
  "basically",
  "literally",
];

// Tuning knobs (founder-revisable, flagged in the build report).
export const FILLER_MIN_WORDS = 8; // ignore short turns — too noisy to judge
export const FILLER_SPIKE_DENSITY = 0.18; // >=18% filler => a spike
export const PACE_MIN_SAMPLES = 3; // warm up the baseline before judging pace
export const PACE_SPIKE_RATIO = 1.4; // >=40% faster than their norm => a spike
export const PACE_MIN_WORDS = 6; // ignore very short utterances for pace

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Filler stats for one rep turn. density = fillers / words. */
export function fillerStats(text: string): {
  fillers: number;
  words: number;
  density: number;
} {
  const words = wordCount(text);
  if (words === 0) return { fillers: 0, words: 0, density: 0 };
  const lower = ` ${text.toLowerCase().replace(/[.,!?;:]/g, " ")} `;
  let fillers = 0;
  for (const f of FILLERS) {
    // F3 (§3.4) — word-boundary match that does NOT consume the surrounding
    // whitespace, so consecutive fillers ("um um") are BOTH counted.
    const re = new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "g");
    const m = lower.match(re);
    if (m) fillers += m.length;
  }
  return { fillers, words, density: fillers / words };
}

export function isFillerSpike(text: string): boolean {
  const { words, density } = fillerStats(text);
  return words >= FILLER_MIN_WORDS && density >= FILLER_SPIKE_DENSITY;
}

/** Words per minute for a turn, given its speaking duration (seconds). Returns
 *  null when the duration is too short/unknown to be meaningful. */
export function turnWpm(text: string, durationSec: number): number | null {
  const words = wordCount(text);
  if (words < PACE_MIN_WORDS || durationSec < 0.5) return null;
  return words / (durationSec / 60);
}

/** A rolling baseline of the rep's own pace (running mean + count). */
export type PaceBaseline = { mean: number; count: number };

export function updatePaceBaseline(
  baseline: PaceBaseline,
  wpm: number
): PaceBaseline {
  const count = baseline.count + 1;
  const mean = baseline.mean + (wpm - baseline.mean) / count;
  return { mean, count };
}

/** True when this turn's pace is a spike vs the rep's warmed-up baseline. */
export function isPaceSpike(wpm: number, baseline: PaceBaseline): boolean {
  return (
    baseline.count >= PACE_MIN_SAMPLES &&
    baseline.mean > 0 &&
    wpm >= baseline.mean * PACE_SPIKE_RATIO
  );
}
