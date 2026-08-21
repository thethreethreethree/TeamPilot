import type { CueDecision } from "../coachingStrategy";
import { parseCueDecision } from "../parseCueDecision";
import { HUDDLE_PHASES, HUDDLE_TRIGGERS } from "./huddleCuePrompt";

/**
 * Parse + VALIDATE a huddle cue model response into a CueDecision. Thin wrapper over the shared
 * parseCueDecision (§2.2 single-source) pinned to the HUDDLE vocabulary — a leaked non-huddle trigger
 * normalizes to "none"/"unknown" and can't masquerade as a valid huddle cue. Silent-safe (§5 / §3.4).
 */
const PHASES = new Set<string>(HUDDLE_PHASES);
const TRIGGERS = new Set<string>(HUDDLE_TRIGGERS);

export function parseHuddleCue(rawText: string, opts?: { force?: boolean }): CueDecision {
  return parseCueDecision(rawText, { validPhases: PHASES, validTriggers: TRIGGERS, force: opts?.force });
}
