import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * Generate the meeting dissect AND store it as an append-only event when it has signal (mirrors the sales
 * runAndStoreDissect). On a with-turns run that produced NO signal, emit a `meeting.dissect_attempted` marker so
 * a future backfill/trigger BACKS OFF instead of re-running a ~20s LLM call on the same stuck session forever
 * (the sales dissect-cron cost loop, 2026-08-14). Best-effort on the event store — the dissect still returns.
 */
export async function generateAndStoreMeetingDissect(args: {
  companyId: string;
  actorId: string;
  sessionId: string;
  sessionTitle?: string;
  segments: StrategyTranscriptSegment[];
}): Promise<MeetingDissect> {
  const dissect = await generateMeetingDissect({
    companyId: args.companyId,
    sessionTitle: args.sessionTitle,
    segments: args.segments,
  });
  const subject = `meeting_session:${args.sessionId}`;

  if (dissect.hasSignal) {
    try {
      await createAdminClient()
        .from("events")
        .insert({
          company_id: args.companyId,
          actor: args.actorId,
          kind: "meeting.dissect_generated",
          subject,
          payload: {
            decisions: dissect.decisions,
            actions: dissect.actions,
            open_items: dissect.openItems,
            effectiveness: dissect.effectiveness,
            overall: dissect.overall ?? null,
            coach_version: "meeting-dissect-v1",
          },
        });
    } catch {
      /* best-effort — the dissect still returns */
    }
  } else if (args.segments.length > 0) {
    // The LLM ran (there were turns) but produced no signal — emit an ATTEMPTED marker so a backfill backs off
    // rather than re-running the full LLM call on this session every pass.
    try {
      await createAdminClient()
        .from("events")
        .insert({
          company_id: args.companyId,
          actor: args.actorId,
          kind: "meeting.dissect_attempted",
          subject,
          payload: { reason: "no_signal", coach_version: "meeting-dissect-v1" },
        });
    } catch {
      /* best-effort — the backoff just doesn't apply this run */
    }
  }
  return dissect;
}
