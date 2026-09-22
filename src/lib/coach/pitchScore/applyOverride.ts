import { createAdminClient as createServiceRoleClient } from "@/lib/supabase/admin";
import { BAND_LABEL, bandFor as gamificationBandFor } from "@/lib/coach/gamification/bands";
import { scorePitch, type GradedElement, type DetectedBonus, type DetectedViolation } from "./scorePitch";
import { BONUSES_BY_ID, ELEMENTS_BY_ID, GRADE_CREDIT, VIOLATIONS_BY_ID, type Grade } from "./rubric";
import type { StoredPitch } from "./readPitchScore";

/**
 * Apply a manager's correction to one item and recompute the score.
 *
 * Specified by the rubric (page 7): *"Manager override: managers can adjust any bonus or
 * violation, with the change logged."* The founder widened it to element grades on 2026-09-21.
 *
 * THE ARITHMETIC LIVES HERE, not in SQL, and that is deliberate. The recompute runs through
 * `scorePitch` — the same function that produced the original score — so the Delivery 27→35
 * scaling, the +30 bonus cap, the zero floor and the 40-base qualifying test all keep exactly one
 * home. A SQL version of this would restate six decisions that already have authorities, and all
 * six would agree on the day they were written, which is what makes that class invisible (§2.2).
 *
 * The band comes from `gamification/bands.ts` for the same reason — a copy of those thresholds
 * shipped earlier today and disagreed with the rep's own Arena on the same page.
 */

export type OverrideRequest = {
  companyId: string;
  pitchId: string;
  actorId: string;
  // enum-source: pitch_score_overrides.item_type
  itemType: "element" | "bonus" | "violation";
  itemId: string;
  /** element: the new grade. bonus/violation: "awarded" | "removed". */
  newValue: string;
  reason: string;
};

export type OverrideResult =
  | { ok: true; overrideId: string; base: number; total: number; qualifying: boolean }
  | { ok: false; reason: "not_found" | "unknown_item" | "invalid_value" | "write_failed" };

/** What the corrected pitch would score. Pure, so the recompute can be tested without a database. */
export function recomputeWithOverride(
  pitch: Pick<StoredPitch, "elements" | "events" | "deliveryScaled" | "notQualifyingReason">,
  req: Pick<OverrideRequest, "itemType" | "itemId" | "newValue">
): ReturnType<typeof scorePitch> {
  const elements: GradedElement[] = pitch.elements
    .filter((e) => ELEMENTS_BY_ID.has(e.elementId))
    .map((e) => ({ elementId: e.elementId, grade: e.grade }));

  const bonuses: DetectedBonus[] = pitch.events
    .filter((e) => e.type === "bonus" && BONUSES_BY_ID.has(e.itemId))
    // confidence 1 because the scorer already applied its floor when it awarded these; re-judging
    // them here would re-run a decision that has been made (§2.2).
    .map((e) => ({ bonusId: e.itemId, confidence: 1 }));

  const violations: DetectedViolation[] = pitch.events
    .filter((e) => e.type === "violation" && e.points > 0 && VIOLATIONS_BY_ID.has(e.itemId))
    .map((e) => ({ violationId: e.itemId }));

  if (req.itemType === "element") {
    const i = elements.findIndex((e) => e.elementId === req.itemId);
    const graded: GradedElement = { elementId: req.itemId, grade: req.newValue as Grade };
    if (i >= 0) elements[i] = graded;
    else elements.push(graded);
  } else if (req.itemType === "bonus") {
    const i = bonuses.findIndex((b) => b.bonusId === req.itemId);
    if (req.newValue === "removed") {
      if (i >= 0) bonuses.splice(i, 1);
    } else if (i < 0) {
      bonuses.push({ bonusId: req.itemId, confidence: 1 });
    }
  } else {
    const i = violations.findIndex((v) => v.violationId === req.itemId);
    if (req.newValue === "removed") {
      if (i >= 0) violations.splice(i, 1);
    } else if (i < 0) {
      violations.push({ violationId: req.itemId });
    }
  }

  return scorePitch({
    elements,
    bonuses,
    violations,
    // Both are FACTS ABOUT THE CONVERSATION, not about how an element was graded, so an override
    // must not change either. `deliveryScaled` is the scorer's verdict that no objection occurred;
    // reachedDiscovery likewise. A manager who believes the pitch DID reach Discovery is disputing
    // the transcript, which is a re-score, not a correction.
    objectionOccurred: !pitch.deliveryScaled,
    reachedDiscovery: pitch.notQualifyingReason !== "Didn't reach Discovery",
  });
}

/** Points the corrected item is now worth, from the rubric — used for the log row, not the total. */
function pointsFor(itemType: OverrideRequest["itemType"], itemId: string, newValue: string): number {
  if (itemType === "element") {
    const def = ELEMENTS_BY_ID.get(itemId);
    return def ? def.points * (GRADE_CREDIT[newValue as Grade] ?? 0) : 0;
  }
  if (newValue === "removed") return 0;
  if (itemType === "bonus") return BONUSES_BY_ID.get(itemId)?.points ?? 0;
  return VIOLATIONS_BY_ID.get(itemId)?.deduction ?? 0;
}

function validValue(itemType: OverrideRequest["itemType"], value: string): boolean {
  return itemType === "element"
    ? value === "hit" || value === "partial" || value === "missed"
    : value === "awarded" || value === "removed";
}

export async function applyOverride(
  req: OverrideRequest,
  pitch: StoredPitch
): Promise<OverrideResult> {
  const known =
    req.itemType === "element"
      ? ELEMENTS_BY_ID.has(req.itemId)
      : req.itemType === "bonus"
        ? BONUSES_BY_ID.has(req.itemId)
        : VIOLATIONS_BY_ID.has(req.itemId);
  if (!known) return { ok: false, reason: "unknown_item" };
  if (!validValue(req.itemType, req.newValue)) return { ok: false, reason: "invalid_value" };

  // What it was, for the log. Read from the stored evidence rather than assumed, so the row says
  // what actually changed rather than what the caller believed was there.
  const oldElement = pitch.elements.find((e) => e.elementId === req.itemId);
  const oldEvent = pitch.events.find((e) => e.itemId === req.itemId);
  const oldValue =
    req.itemType === "element"
      ? (oldElement?.grade ?? null)
      : oldEvent
        ? oldEvent.type === "rejected_bonus"
          ? "removed"
          : "awarded"
        : null;
  const oldPoints = req.itemType === "element" ? (oldElement?.points ?? null) : (oldEvent?.points ?? null);

  const score = recomputeWithOverride(pitch, req);

  const sb = createServiceRoleClient();
  const { data, error } = await sb.rpc("apply_pitch_score_override", {
    p_company_id: req.companyId,
    p_pitch_id: req.pitchId,
    p_actor_id: req.actorId,
    p_item_type: req.itemType,
    p_item_id: req.itemId,
    p_old_value: oldValue,
    p_new_value: req.newValue,
    p_old_points: oldPoints,
    p_new_points: pointsFor(req.itemType, req.itemId, req.newValue),
    p_reason: req.reason,
    p_base: score.base,
    p_bonus: score.bonus,
    p_violations: score.violations,
    p_total: score.total,
    p_qualifying: score.qualifying,
    p_not_qualifying_reason: score.notQualifyingReason,
    p_section_points: score.sectionPoints,
    p_band: BAND_LABEL[gamificationBandFor(score.total)],
  });

  if (error || typeof data !== "string") {
    // Logged with the detail, returned as a reason code: the database's message can name columns
    // and constraints (CWE-209), and the caller only needs to know it did not happen.
    // eslint-disable-next-line no-console
    console.error(
      `[applyOverride] rpc failed pitch=${req.pitchId} item=${req.itemId}: ${error?.message ?? `unexpected return ${typeof data}`}`
    );
    return { ok: false, reason: "write_failed" };
  }

  return {
    ok: true,
    overrideId: data,
    base: score.base,
    total: score.total,
    qualifying: score.qualifying,
  };
}
