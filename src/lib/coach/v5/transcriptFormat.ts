import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Shared transcript-formatting helper for the sales-coach analysis prompts.
 *
 * `speakerLabel` was copy-pasted byte-identically across salesIntel/Moments/Pivot/Score Prompt.ts. Consolidated
 * here (audit finding 2026-07-22) so a change to how speakers are labelled happens in ONE place instead of
 * drifting across engines. (salesWhy.ts has a deliberately different mapping and is intentionally NOT included.)
 */
export function speakerLabel(speaker: TranscriptSegment["speaker"]): string {
  if (speaker === "agent") return "REP";
  if (speaker === "customer") return "CUSTOMER";
  return "UNKNOWN";
}
