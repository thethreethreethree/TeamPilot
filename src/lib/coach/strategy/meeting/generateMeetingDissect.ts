import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import type { StrategyTranscriptSegment } from "../coachingStrategy";
import { buildMeetingDissectSystemPrompt, buildMeetingDissectUserMessage } from "./meetingDissectPrompt";
import { parseMeetingDissect, EMPTY_MEETING_DISSECT, type MeetingDissect } from "./parseMeetingDissect";

/**
 * Generate the post-meeting DISSECT from a meeting's diarized transcript (Phase-6). Reuses the sales
 * `dissectCoachV5` LLM binding (a generic deep-eval call, controlExempt — same as the meeting cue). Measures
 * the meeting's CONSEQUENCES only (§3.5); it never sees the coach's cues, so it cannot grade agreement.
 *
 * INV22 (error-dressed-as-no-data): an EMPTY or unparseable LLM response is NOT silently treated as "the meeting
 * produced nothing" — the three outcomes are logged LOUDLY so a token-starvation regression surfaces immediately
 * (the 2026-07-30 sales outage was exactly this class). A genuinely thin/social meeting returns the honest empty
 * state (§3.4 — no fabricated decisions).
 */
export async function generateMeetingDissect(args: {
  companyId: string;
  sessionTitle?: string;
  segments: StrategyTranscriptSegment[];
}): Promise<MeetingDissect> {
  try {
    if (args.segments.length === 0) return EMPTY_MEETING_DISSECT;

    const systemPrompt = buildMeetingDissectSystemPrompt();
    const userMessage = buildMeetingDissectUserMessage({
      sessionTitle: args.sessionTitle,
      segments: args.segments,
    });

    const r = await dissectCoachV5({ companyId: args.companyId, systemPrompt, userMessage });
    if (r.suppressed) return EMPTY_MEETING_DISSECT;

    if (!r.text || !r.text.trim()) {
      // eslint-disable-next-line no-console
      console.error(
        `[generateMeetingDissect] LLM returned EMPTY text (model=${r.model}, provider=${r.provider}) — likely token-budget starvation. Dissect will be blank.`
      );
      return EMPTY_MEETING_DISSECT;
    }

    const parsed = parseMeetingDissect(r.text);
    if (!parsed.hasSignal) {
      // eslint-disable-next-line no-console
      console.error(
        `[generateMeetingDissect] parse produced no signal (textLen=${r.text.length}, model=${r.model}) — JSON parse failure or no consequence extracted.`
      );
      return EMPTY_MEETING_DISSECT;
    }
    return parsed;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[generateMeetingDissect] threw: ${e instanceof Error ? e.message : String(e)}`);
    return EMPTY_MEETING_DISSECT;
  }
}
