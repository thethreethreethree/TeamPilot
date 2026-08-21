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

export type DissectDecision = { decision: string; context: string };
/** owner === null is the tracked failure mode (an action with no owner walks out of the room un-done). */
export type DissectAction = { action: string; owner: string | null };
export type DissectOpenItem = { item: string; why: string };
export type DissectEffectiveness = { focused: boolean; note: string };

export type MeetingDissect = {
  hasSignal: boolean;
  decisions: DissectDecision[];
  actions: DissectAction[];
  openItems: DissectOpenItem[];
  effectiveness: DissectEffectiveness | null;
  overall?: string;
};

export const EMPTY_MEETING_DISSECT: MeetingDissect = {
  hasSignal: false,
  decisions: [],
  actions: [],
  openItems: [],
  effectiveness: null,
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
    return EMPTY_MEETING_DISSECT;
  }
  if (!raw || typeof raw !== "object") return EMPTY_MEETING_DISSECT;
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
    decisions,
    actions,
    openItems,
    effectiveness,
    ...(overall ? { overall } : {}),
  };
}
