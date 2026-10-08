import { transcriptHasSpeech } from "@/lib/coach/doorlog/speechPresence";

/**
 * Does this call need "which of these voices is you?" instead of "is this voice you?" — the one verdict (§2.2),
 * read by /attribute-unlabelled and by the web "whose voice" card. Pure, so the card can import it.
 *
 * WHY (2026-10-08). When recovery separates two voices but cannot tell which is the rep, it saves every line as
 * 'unknown'. The old question assumed an all-'unknown' transcript was ONE voice and relabelled every line one way,
 * so "That's me" on a two-voice call made the customer's words the rep's and scored them (production: cef6995b,
 * 26 lines; 8bde1ce2, 44). Each line now keeps the diarizer's voice id (0270, `speaker_cluster`), and when there
 * are two or more the question is asked per voice. Founder picker 2026-10-08: "Keep voices apart".
 *
 * Returns the voices, in order of first appearance, each with a line the rep can read to decide — or null when
 * this is not that case:
 *   - any line already attributed ('agent' / 'customer'), or a person already answered (`source` 'manual');
 *   - any line without a voice id (live capture, or saved before 0270): the voices are not known, so the old
 *     single-voice question is the only honest one;
 *   - fewer than two voices.
 * The server function assign_session_voices (0270) refuses the same cases.
 */
export type TranscriptVoice = { cluster: string; sample: string; lines: number };

type VoiceLine = {
  speaker?: string | null;
  text?: string | null;
  source?: string | null;
  speakerCluster?: string | null;
};

/** The `source` a person's answer is written with. */
const MANUAL = "manual";

export function transcriptVoices(lines: VoiceLine[]): TranscriptVoice[] | null {
  if (lines.length === 0) return null;
  const byCluster = new Map<string, TranscriptVoice>();
  for (const line of lines) {
    if (line.speaker !== "unknown" || line.source === MANUAL || !line.speakerCluster) return null;
    const v = byCluster.get(line.speakerCluster) ?? { cluster: line.speakerCluster, sample: "", lines: 0 };
    v.lines += 1;
    // The sample is what the rep reads to decide, so it must hold WORDS — never a "[clicking]" annotation.
    if (!v.sample && transcriptHasSpeech(line.text)) v.sample = (line.text ?? "").trim().slice(0, 200);
    byCluster.set(line.speakerCluster, v);
  }
  return byCluster.size >= 2 ? [...byCluster.values()] : null;
}

/** Read a row from /segments (snake_case) into the shape above. */
export function voiceLineFromRow(row: {
  speaker?: string | null;
  text?: string | null;
  source?: string | null;
  speaker_cluster?: string | null;
}): VoiceLine {
  return { speaker: row.speaker, text: row.text, source: row.source, speakerCluster: row.speaker_cluster };
}
