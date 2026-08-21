/**
 * Speaker balance for a meeting's DIARIZED transcript (the plan's §3.1 "imbalance" monitor, realized post-hoc in
 * the Dissect). The LIVE coach can't ground imbalance — a single room mic yields no reliable per-speaker split,
 * so it stays silent (A39: never guess who dominated). But the post-meeting Dissect runs on a BATCH-diarized
 * re-transcription with real speaker labels, so "did one voice dominate?" IS answerable there.
 *
 * Pure + honest (§3.4): returns null when there aren't ≥2 distinct speakers with speech — you cannot assess
 * balance from one speaker, so it says nothing rather than fabricate a verdict. Dominance is measured by WORD
 * share (not turn count — many short interjections shouldn't read as domination).
 *
 * PROPOSED threshold (like the rest of the dissect measurement — a defensible default the founder can adjust):
 * one participant holding > DOMINANCE_PCT of the words is "dominating". A single figure (not scaled by speaker
 * count) is deliberate: in a 5-person meeting, one voice at 60%+ of the words is a facilitation problem
 * regardless of how many others were in the room.
 */
export const DOMINANCE_PCT = 60;

export type SpeakerBalance = {
  speakers: number;
  /** The most-talkative speaker's share of the words, 0..100. */
  dominantSharePct: number;
  /** The label of the dominant speaker (from the diarization). */
  dominantSpeaker: string;
  balanced: boolean;
  note: string;
};

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function computeSpeakerBalance(segments: { speaker: string; text: string }[]): SpeakerBalance | null {
  const words = new Map<string, number>();
  for (const s of segments ?? []) {
    const speaker = typeof s?.speaker === "string" ? s.speaker : "";
    const n = wordCount(typeof s?.text === "string" ? s.text : "");
    if (!speaker || n === 0) continue;
    words.set(speaker, (words.get(speaker) ?? 0) + n);
  }
  if (words.size < 2) return null; // can't assess balance with fewer than two speaking participants

  let total = 0;
  let dominantSpeaker = "";
  let dominantWords = 0;
  for (const [speaker, n] of words) {
    total += n;
    if (n > dominantWords) {
      dominantWords = n;
      dominantSpeaker = speaker;
    }
  }
  const dominantSharePct = Math.round((dominantWords / total) * 100);
  const balanced = dominantSharePct <= DOMINANCE_PCT;
  const note = balanced
    ? `Fairly balanced — the most active voice held about ${dominantSharePct}% of the discussion across ${words.size} speakers.`
    : `One voice dominated — about ${dominantSharePct}% of the discussion, across ${words.size} speakers.`;

  return { speakers: words.size, dominantSharePct, dominantSpeaker, balanced, note };
}
