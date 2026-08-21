import type { CueDecision } from "../coachingStrategy";
import { parseCueDecision } from "../parseCueDecision";
import { MEETING_PHASES, MEETING_TRIGGERS } from "./meetingCuePrompt";

/**
 * Parse + VALIDATE a meeting cue model response into a CueDecision. Thin wrapper over the shared
 * parseCueDecision (§2.2 single-source) pinned to the MEETING vocabulary — a leaked non-meeting trigger (e.g.
 * a sales 'objection'/'close') normalizes to "none"/"unknown", so it can't masquerade as a valid meeting cue
 * (plan §6, enforced at the parse layer). Silent-safe on any malformed response (§5 / §3.4).
 */
const PHASES = new Set<string>(MEETING_PHASES);
const TRIGGERS = new Set<string>(MEETING_TRIGGERS);

export function parseMeetingCue(rawText: string, opts?: { force?: boolean }): CueDecision {
  return parseCueDecision(rawText, { validPhases: PHASES, validTriggers: TRIGGERS, force: opts?.force });
}
