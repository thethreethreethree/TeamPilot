import type { CueDecision, CueImportance } from "./coachingStrategy";

/**
 * Shared, pure parse+validate for a live-cue model response → CueDecision. One source for the output
 * contract every strategy's brain shares (§2.2 single-source): sales, meeting, and huddle differ ONLY in
 * their valid phase/trigger vocabularies, not in how a response is validated. Modeled on the sales
 * generateLiveCue parse (liveCue.ts:178-209).
 *
 * TOTAL and silent-safe: a malformed / unparseable / out-of-vocabulary / instruction-shaped response resolves
 * to SILENT, never a guessed cue (§5 bad-parse-fails-safe; §3.4 never fabricate). The understanding gate
 * holds — an empty cue is not a cue, regardless of `shouldCue` — unless `force` (the wearer explicitly asked),
 * in which case any non-empty cue counts.
 *
 * An out-of-vocabulary phase/trigger normalizes to "unknown"/"none": this is also what stops a LEAKED cue
 * from another domain (e.g. a sales 'objection'/'close' surfacing in a meeting) from masquerading as a valid
 * trigger — the vocab set is the gate.
 */
export function parseCueDecision(
  rawText: string,
  opts: { validPhases: ReadonlySet<string>; validTriggers: ReadonlySet<string>; force?: boolean }
): CueDecision {
  const silent: CueDecision = { shouldCue: false, cue: null, trigger: "none", phase: "unknown", importance: "low" };

  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return silent;
  }
  if (typeof raw !== "object" || raw === null) return silent;
  const o = raw as Record<string, unknown>;

  const phase =
    typeof o["phase"] === "string" && opts.validPhases.has(o["phase"]) ? (o["phase"] as string) : "unknown";
  const trigger =
    typeof o["trigger"] === "string" && opts.validTriggers.has(o["trigger"]) ? (o["trigger"] as string) : "none";

  // Importance defaults to "medium" when the model omits/malforms it — a real cue is never downgraded to a
  // throwaway "low" by a parser accident; only an explicit "low"/"high" moves it off medium.
  const importance: CueImportance =
    o["importance"] === "high" || o["importance"] === "low" ? (o["importance"] as CueImportance) : "medium";

  const cue = typeof o["cue"] === "string" ? o["cue"].trim() : "";

  // Understanding gate: an empty cue means stay silent regardless of `shouldCue`. When forced, any non-empty
  // cue counts — the wearer asked.
  const shouldCue = opts.force ? cue.length > 0 : o["shouldCue"] === true && cue.length > 0;

  if (!shouldCue) return { ...silent, phase, trigger };
  return { shouldCue: true, cue, trigger, phase, importance };
}
