/**
 * Meeting Coach — post-meeting DISSECT measurement (Phase-6 of docs/MeetingCoach-BuildPlan.md).
 *
 * The §3.5 discipline is the whole point: a meeting review must measure the meeting's DOWNSTREAM CONSEQUENCES —
 * what the meeting actually PRODUCED — never "were the coach's cues followed" (that would be grading its own
 * homework, the forbidden agreement-metric). So a meeting dissect extracts:
 *   - DECISIONS reached (a meeting's core output),
 *   - ACTIONS assigned + whether each has an OWNER (owner-less actions are the plan's #1 meeting failure),
 *   - OPEN items raised but left unresolved (a facilitation-quality consequence),
 *   - an EFFECTIVENESS read (focused vs. drifted).
 * Aggregated over time these show whether meetings became more decisive / action-owned / focused — the honest
 * "did meetings improve?" trend. NOTE (audit 2026-08-22): because meeting cues run day-1 (controlExempt), there
 * is NO control-month baseline, so improvement is a TREND over a team's own history, not a before/after.
 *
 * PROPOSED measurement (a defensible default, BUILT rather than offloaded as "founder decides"): the founder may
 * adjust WHICH consequences are measured; this is the recommended set. Pure + total + silent-safe, mirroring
 * parseMeetingCue.
 */

import type { SpeakerBalance } from "./speakerBalance";

export type DissectDecision = { decision: string; context: string };
/** owner === null is the tracked failure mode (an action with no owner walks out of the room un-done). */
export type DissectAction = { action: string; owner: string | null };
export type DissectOpenItem = { item: string; why: string };
export type DissectEffectiveness = { focused: boolean; note: string };

/** Prep-up agenda outcome (founder 2026-08-22): did the meeting hit its goal + which must-discuss topics were
 *  covered vs missed. §3.5 consequence — measured against the meeting's OWN pre-set agenda, not the coach's cues. */
export type GoalAttained = "yes" | "partial" | "no" | "unknown";
export type DissectAgenda = {
  goal: string;
  goalAttained: GoalAttained;
  note: string;
  topics: Array<{ text: string; covered: boolean }>;
};

/**
 * Why the dissect produced no signal (audit H4, 2026-08-22) — so the store can tell a GENUINE thin meeting
 * ("empty": the LLM ran, parsed, found nothing → back off permanently) from a TRANSIENT failure ("transient":
 * empty LLM text / unparseable JSON / a throw / control-suppressed → DON'T back off; let the next view retry so
 * a real meeting's content isn't lost to a one-off token-starvation). "signal": a real dissect.
 */
export type DissectOutcome = "signal" | "empty" | "transient";

export type MeetingDissect = {
  hasSignal: boolean;
  /** Set by generateMeetingDissect (and parseMeetingDissect for the parse branch). Absent = treat as its hasSignal. */
  outcome?: DissectOutcome;
  decisions: DissectDecision[];
  actions: DissectAction[];
  openItems: DissectOpenItem[];
  effectiveness: DissectEffectiveness | null;
  // Speaker balance is computed from the diarized SEGMENTS (not the LLM), so the parse leaves it null;
  // generateMeetingDissect fills it in. Null when balance couldn't be assessed (< 2 speaking participants).
  balance: SpeakerBalance | null;
  // Agenda coverage (Prep-up only) — assembled by generateMeetingDissect from the LLM's goal-attainment judgment
  // + a re-assessment of topic coverage over the FULL transcript. Absent for a prep-less meeting.
  agenda?: DissectAgenda;
  overall?: string;
};

export const EMPTY_MEETING_DISSECT: MeetingDissect = {
  hasSignal: false,
  decisions: [],
  actions: [],
  openItems: [],
  effectiveness: null,
  balance: null,
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Parse the LLM's meeting-dissect JSON. Total + silent-safe: a malformed / non-object / non-JSON response, or a
 * response with no extractable consequence, yields EMPTY (hasSignal:false) rather than a fabricated review
 * (§3.4 — never invent a decision or an owner that wasn't in the meeting). An owner that is absent / "none" /
 * "unassigned" normalizes to null so the owner-less-action signal is honest.
 */
export function parseMeetingDissect(text: string): MeetingDissect {
  let raw: unknown;
  try {
    // Tolerate a fenced ```json block or surrounding prose — extract the first {...}.
    const m = text.match(/\{[\s\S]*\}/);
    raw = JSON.parse(m ? m[0] : text);
  } catch {
    // Unparseable JSON is a TRANSIENT failure (a truncated/token-starved response), NOT a thin meeting (H4).
    return { ...EMPTY_MEETING_DISSECT, outcome: "transient" };
  }
  // An array (or non-object) is malformed — not the expected dissect object. typeof [] === "object", so guard it
  // explicitly. Malformed shape is a TRANSIENT failure (the model produced garbage), not a thin meeting.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_MEETING_DISSECT, outcome: "transient" };
  const o = raw as Record<string, unknown>;

  const decisions: DissectDecision[] = arr(o.decisions)
    .map((d) => {
      const dd = (d ?? {}) as Record<string, unknown>;
      return { decision: str(dd.decision), context: str(dd.context) };
    })
    .filter((d) => d.decision.length > 0);

  // Models frequently emit the STRING "null" (not JSON null) or a vague non-owner; all must normalize to null so
  // an owner-less action is honestly counted as owner-less (the exact signal this dissect exists to surface).
  const NO_OWNER = /^(null|none|no one|nobody|unassigned|unowned|someone|the team|everyone|n\/a|tbd|-)$/i;
  const actions: DissectAction[] = arr(o.actions)
    .map((a) => {
      const aa = (a ?? {}) as Record<string, unknown>;
      const owner = str(aa.owner);
      return { action: str(aa.action), owner: owner && !NO_OWNER.test(owner) ? owner : null };
    })
    .filter((a) => a.action.length > 0);

  const openItems: DissectOpenItem[] = arr(o.openItems)
    .map((i) => {
      const ii = (i ?? {}) as Record<string, unknown>;
      return { item: str(ii.item), why: str(ii.why) };
    })
    .filter((i) => i.item.length > 0);

  let effectiveness: DissectEffectiveness | null = null;
  if (o.effectiveness && typeof o.effectiveness === "object") {
    const e = o.effectiveness as Record<string, unknown>;
    const note = str(e.note);
    if (note.length > 0 || typeof e.focused === "boolean") {
      effectiveness = { focused: e.focused === true, note };
    }
  }

  const overall = str(o.overall);
  const hasSignal =
    decisions.length > 0 || actions.length > 0 || openItems.length > 0 || effectiveness !== null;

  return {
    hasSignal,
    // Parsed cleanly: a real dissect is "signal"; a valid-but-empty response is a GENUINE thin meeting ("empty"),
    // which legitimately backs off — distinct from the "transient" parse-failure above.
    outcome: hasSignal ? "signal" : "empty",
    decisions,
    actions,
    openItems,
    effectiveness,
    balance: null, // filled by generateMeetingDissect from the diarized segments
    ...(overall ? { overall } : {}),
  };
}

/**
 * Extract the LLM's Prep-up agenda judgment (goal attainment + the topic ids it judged covered over the FULL
 * transcript) from the same dissect JSON. Separate from parseMeetingDissect so the consequence parse stays
 * unchanged; generateMeetingDissect assembles the final DissectAgenda (with topic texts). Total + silent-safe:
 * returns null when there's no agenda block. Pure.
 */
export function parseAgendaJudgment(text: string): { goalAttained: GoalAttained; note: string; coveredIds: string[] } | null {
  let raw: unknown;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    raw = JSON.parse(m ? m[0] : text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const a = (raw as Record<string, unknown>).agenda;
  if (!a || typeof a !== "object") return null;
  const ao = a as Record<string, unknown>;
  const ga = str(ao.goalAttained).toLowerCase();
  const goalAttained: GoalAttained = ga === "yes" || ga === "partial" || ga === "no" ? (ga as GoalAttained) : "unknown";
  const coveredIds = arr(ao.covered)
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  return { goalAttained, note: str(ao.note), coveredIds: Array.from(new Set(coveredIds)) };
}
