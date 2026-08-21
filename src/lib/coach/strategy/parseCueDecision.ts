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
 * An out-of-vocabulary phase/trigger normalizes to "unknown"/"none". Critically, an AUTO cue must carry a VALID
 * trigger to be delivered — so a LEAKED cue from another domain (a sales 'close'/'objection' surfacing in a
 * meeting) whose trigger normalizes to "none" is DROPPED, not delivered with a relabeled trigger (the plan's
 * hard invariant: a sales closing cue must never reach a meeting). A forced cue (the wearer explicitly asked)
 * still delivers any non-empty cue — the leak risk there is bounded by the clean prompt + the fence.
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

  // Understanding gate: an empty cue means stay silent regardless of `shouldCue`. When forced, any non-empty cue
  // counts — the wearer asked. For an AUTO cue, additionally require a VALID (non-"none") trigger: a cue whose
  // trigger normalized to "none" (out-of-vocab / leaked from another domain, or incoherent) is NOT delivered —
  // this is the actual gate on cross-domain leakage (a sales cue can't ride into a meeting with a relabeled
  // trigger).
  const shouldCue = opts.force ? cue.length > 0 : o["shouldCue"] === true && cue.length > 0 && trigger !== "none";

  if (!shouldCue) return { ...silent, phase, trigger };
  return { shouldCue: true, cue, trigger, phase, importance };
}
