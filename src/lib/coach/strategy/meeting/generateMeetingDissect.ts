import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MeetingAgenda, StrategyTranscriptSegment } from "../coachingStrategy";
import { buildMeetingDissectSystemPrompt, buildMeetingDissectUserMessage } from "./meetingDissectPrompt";
import { parseMeetingDissect, parseAgendaJudgment, EMPTY_MEETING_DISSECT, type DissectAgenda, type MeetingDissect } from "./parseMeetingDissect";
import { computeSpeakerBalance } from "./speakerBalance";

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
  /** Prep-up agenda — when present, the dissect also measures goal attainment + covered/missed topics (§3.5). */
  agenda?: MeetingAgenda;
}): Promise<MeetingDissect> {
  try {
    // No transcript segments — the audio transcribed to nothing (a genuinely silent meeting). Honest empty; a
    // re-transcribe of silent audio won't differ, so this legitimately backs off (not a "transient" retry).
    if (args.segments.length === 0) return { ...EMPTY_MEETING_DISSECT, outcome: "empty" };

    const systemPrompt = buildMeetingDissectSystemPrompt();
    const userMessage = buildMeetingDissectUserMessage({
      sessionTitle: args.sessionTitle,
      segments: args.segments,
      agenda: args.agenda,
    });

    const r = await dissectCoachV5({ companyId: args.companyId, systemPrompt, userMessage });
    // Control-suppressed → the LLM never ran; TRANSIENT (retry on the next view), never a permanent empty.
    if (r.suppressed) return { ...EMPTY_MEETING_DISSECT, outcome: "transient" };

    if (!r.text || !r.text.trim()) {
      // eslint-disable-next-line no-console
      console.error(
        `[generateMeetingDissect] LLM returned EMPTY text (model=${r.model}, provider=${r.provider}) — likely token-budget starvation. TRANSIENT — the next view will retry (audit H4).`
      );
      return { ...EMPTY_MEETING_DISSECT, outcome: "transient" };
    }

    const parsed = parseMeetingDissect(r.text);
    if (!parsed.hasSignal) {
      // parsed.outcome distinguishes a GENUINE thin meeting ("empty" — legitimate backoff) from an unparseable
      // token-starved response ("transient" — retry). Only the transient case is a defect worth logging loudly.
      if (parsed.outcome === "transient") {
        // eslint-disable-next-line no-console
        console.error(
          `[generateMeetingDissect] parse FAILED (textLen=${r.text.length}, model=${r.model}) — unparseable JSON; TRANSIENT, will retry (audit H4).`
        );
      }
      return parsed;
    }
    // Balance is computed from the diarized segments (not the LLM) — the plan's imbalance monitor, realized
    // post-hoc. Null when < 2 speaking participants (the parse left it null; fill it here).
    const balance = computeSpeakerBalance(args.segments);

    // Prep-up agenda coverage (§3.5): the LLM judged goal attainment + which topic ids were discussed over the
    // FULL transcript; map that onto the agenda's topics (text + covered) so the review shows covered vs missed.
    let agenda: DissectAgenda | undefined;
    if (args.agenda) {
      const judgment = parseAgendaJudgment(r.text);
      const coveredSet = new Set(judgment?.coveredIds ?? []);
      agenda = {
        goal: args.agenda.goal,
        goalAttained: judgment?.goalAttained ?? "unknown",
        note: judgment?.note ?? "",
        // OR-in the LIVE-accumulated coverage (audit INT-2): a topic the live loop already marked covered stays
        // covered even if the dissect LLM drops/alters its id — the dissect must not THROW AWAY coverage the live
        // coach earned. `t.covered` comes from the prep's persisted topics; `coveredSet` is the dissect's own read.
        topics: args.agenda.topics.map((t) => ({ text: t.text, covered: t.covered || coveredSet.has(t.id) })),
      };
    }

    return { ...parsed, balance, outcome: "signal", ...(agenda ? { agenda } : {}) };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[generateMeetingDissect] threw: ${e instanceof Error ? e.message : String(e)}`);
    // A throw is TRANSIENT (network/LLM blip) — never a permanent empty; the next view retries (audit H4).
    return { ...EMPTY_MEETING_DISSECT, outcome: "transient" };
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
  /** Prep-up agenda — measured into the dissect (goal attainment + covered/missed topics) when present. */
  agenda?: MeetingAgenda;
}): Promise<MeetingDissect> {
  const dissect = await generateMeetingDissect({
    companyId: args.companyId,
    sessionTitle: args.sessionTitle,
    segments: args.segments,
    agenda: args.agenda,
  });
  const subject = `meeting_session:${args.sessionId}`;
  const outcome = dissect.outcome ?? (dissect.hasSignal ? "signal" : "empty");

  if (outcome === "signal") {
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
            balance: dissect.balance,
            agenda: dissect.agenda ?? null,
            overall: dissect.overall ?? null,
            coach_version: "meeting-dissect-v1",
          },
        });
    } catch {
      /* best-effort — the dissect still returns */
    }
  } else if (outcome === "empty") {
    // GENUINE thin meeting — the LLM ran, parsed, and found no decisions/actions (or the audio was silent). Emit
    // the ATTEMPTED backoff marker so the route BACKS OFF instead of re-running batch STT + ~20s LLM every view
    // (review finding #1; the 2026-08-14 cost loop). This is the ONLY no-signal case that should back off.
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
  // outcome === "transient": DO NOT write a marker (audit H4). A one-off token-starvation / parse-failure / throw
  // must NOT be cached as a permanent empty — the meeting has real content in the audio. With no marker, the route
  // re-transcribes + retries on the next view and self-heals (a success then writes the durable generated event).
  return dissect;
}
