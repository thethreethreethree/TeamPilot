/**
 * Session interaction flags — "Needs Manager/Admin Examination" and "Outstanding
 * Performance Review" (founder 2026-07-09).
 *
 * These classify a FINISHED session by the QUALITY of the prospect interaction,
 * composing signals the system already computes (§A16 — compose, don't fork):
 *   - outcome            (sold / no_sale / … — coaching_sessions.outcome)
 *   - pivot direction    (gained / lost — coach.session_pivot_generated)
 *   - net sentiment      (warming / cooling — from the timeline moments)
 *
 * §A18 CONSTRAINT (load-bearing): the "Needs Examination" flag is manager/admin-
 * facing, and the After-Pitch SCORES are owner-private (managers get null by RLS,
 * 0080). So the classification uses ONLY manager-visible signals (outcome, pivot,
 * sentiment) — never the scores. A flag derived from scores would leak owner-private
 * data to a manager, which is precisely the misuse A18 exists to prevent. Both flags
 * use the same signal set so neither can leak scores on the shared session list.
 *
 * Founder rules (2026-07-09):
 *   - Needs Examination: a NEGATIVE interaction (lost pivot OR net-cooling
 *     sentiment) — regardless of outcome. A rough call that still SOLD is examined
 *     anyway; a graceful no-sale with a warm interaction is NOT flagged.
 *   - Outstanding Review: outcome = sold AND a POSITIVE interaction (gained pivot
 *     OR net-warming sentiment) AND not negative.
 *   - Precedence: negative wins. A sold call whose interaction went badly is
 *     Examination, not Outstanding (the interaction wasn't positive).
 *
 * Pure + dependency-free so the rule is a tested unit; the plumbing extracts the
 * signals from storage and calls this.
 */

export type SessionFlagKind = "examination" | "outstanding";

export type SessionFlagReason = {
  /** short label, e.g. "Lost pivot" */
  label: string;
  /** the composed detail, e.g. the pivot reason or the cooling moment text */
  detail: string;
};

export type SessionFlag = {
  kind: SessionFlagKind;
  /** one-line headline shown on the badge's detail view */
  headline: string;
  /** composed, manager-safe explanation lines (never score-derived) */
  reasons: SessionFlagReason[];
};

export type SessionSignals = {
  /** coaching_sessions.outcome — sold / no_sale / follow_up / no_contact / undecided / null */
  outcome: string | null;
  /** the single bidirectional pivot direction, or null if none generated */
  pivotDirection: "gained" | "lost" | null;
  /** the pivot's reasoning text (manager-visible), for the explanation */
  pivotReason?: string | null;
  /** net timeline sentiment: more cooling than warming → "cooling", etc. */
  sentiment: "warming" | "cooling" | "flat" | null;
  /** manager-visible timeline moments that cooled — for the explanation */
  coolingMoments?: string[];
  /** manager-visible timeline moments that warmed — for the explanation */
  warmingMoments?: string[];
};

/**
 * Net timeline sentiment from the per-moment sentiment tally (manager-visible
 * moments). More cooling moments than warming → "cooling"; more warming → "warming";
 * a tie with at least one signal → "flat"; no signal at all → null. Defensive: a
 * moment with an absent/unknown sentiment (older stored moments) just doesn't count.
 */
export function netSentimentFromMoments(
  moments: ReadonlyArray<{ sentiment?: string | null }>
): "warming" | "cooling" | "flat" | null {
  let warm = 0;
  let cool = 0;
  for (const m of moments) {
    if (m.sentiment === "warming") warm += 1;
    else if (m.sentiment === "cooling") cool += 1;
  }
  if (warm === 0 && cool === 0) return null;
  if (cool > warm) return "cooling";
  if (warm > cool) return "warming";
  return "flat";
}

const OUTCOME_LABEL: Record<string, string> = {
  sold: "Closed / sold",
  no_sale: "No sale",
  follow_up: "Follow-up",
  no_contact: "No contact",
  undecided: "Undecided",
};

function outcomeLabel(outcome: string | null): string {
  return (outcome && OUTCOME_LABEL[outcome]) || "Outcome not recorded";
}

/**
 * Classify a session's interaction. Returns null when the signals are absent or
 * neutral (no badge) — only clearly positive-and-closed or clearly-negative
 * sessions are flagged, so the surface is a real signal, not noise.
 */
export function classifySession(s: SessionSignals): SessionFlag | null {
  const negative =
    s.pivotDirection === "lost" || s.sentiment === "cooling";
  const positive =
    s.pivotDirection === "gained" || s.sentiment === "warming";

  // Precedence: a negative interaction is examined regardless of outcome — even
  // a sale that went badly (founder rule). Negative wins over positive.
  if (negative) {
    const reasons: SessionFlagReason[] = [];
    if (s.pivotDirection === "lost") {
      reasons.push({
        label: "Lost ground at the pivot",
        detail:
          s.pivotReason?.trim() ||
          "The conversation turned against the rep and didn't recover.",
      });
    }
    if (s.sentiment === "cooling") {
      const moment = s.coolingMoments?.find((m) => m.trim());
      reasons.push({
        label: "Prospect sentiment cooled",
        detail:
          moment?.trim() ||
          "The prospect grew more guarded as the conversation went on.",
      });
    }
    // Outcome is context, not a trigger — but a sold-yet-flagged call is exactly
    // the case a manager most wants to see, so name it.
    reasons.push({
      label: "Outcome",
      detail:
        s.outcome === "sold"
          ? "Closed the sale — but the interaction still went poorly; worth examining how it landed despite the rough patch."
          : outcomeLabel(s.outcome),
    });
    return {
      kind: "examination",
      headline:
        s.outcome === "sold"
          ? "Sold, but the prospect interaction went poorly — worth a look."
          : "The prospect interaction went poorly — worth a manager's look.",
      reasons,
    };
  }

  // Outstanding: sold AND a positive interaction (and not negative, handled above).
  if (s.outcome === "sold" && positive) {
    const reasons: SessionFlagReason[] = [];
    reasons.push({ label: "Outcome", detail: "Closed the sale." });
    if (s.pivotDirection === "gained") {
      reasons.push({
        label: "Won ground at the pivot",
        detail:
          s.pivotReason?.trim() ||
          "The rep turned the conversation in their favour at the key moment.",
      });
    }
    if (s.sentiment === "warming") {
      const moment = s.warmingMoments?.find((m) => m.trim());
      reasons.push({
        label: "Prospect sentiment warmed",
        detail:
          moment?.trim() ||
          "The prospect grew more receptive as the conversation went on.",
      });
    }
    return {
      kind: "outstanding",
      headline: "Closed the deal with a strong, positive prospect interaction.",
      reasons,
    };
  }

  return null;
}
