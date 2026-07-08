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
  /** a breakdown moment exists in the timeline (a point the call went wrong) */
  hasBreakdown?: boolean;
  /** the breakdown moment's text, for the explanation */
  breakdownText?: string | null;
  /** manager-visible timeline moments that cooled — for the explanation */
  coolingMoments?: string[];
  /** manager-visible timeline moments that warmed — for the explanation */
  warmingMoments?: string[];
};

/**
 * Apply the two SURFACE gates to a classified flag, returning the flag the caller may
 * show or null. Pure so these invariants are a tested unit:
 *   (1) Never flag an ACTIVE session — a flag reads as how the call RESULTED (founder
 *       wording); a live, mid-call session is premature.
 *   (2) "Examination" is MANAGER/ADMIN-only — a rep must NEVER see a needs-examination
 *       badge on their own session (§3.3 guide-don't-overtake / A11 mirror-not-verdict).
 *       "Outstanding" is visible to everyone (positive reinforcement).
 */
export function gateSessionFlag(
  flag: SessionFlag | null,
  ctx: { status: string; isManager: boolean }
): SessionFlag | null {
  if (ctx.status === "active") return null;
  if (!flag) return null;
  if (flag.kind === "examination" && !ctx.isManager) return null;
  return flag;
}

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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * Parse the stored pivot event payload ({ pivot: PivotMoment }) into the classifier's
 * two fields. Defensive: any non-conforming payload yields nulls (no throw, no flag)
 * — a malformed/absent pivot must not crash the list nor fabricate a direction (§3.4).
 */
function readPivot(payload: unknown): {
  direction: "gained" | "lost" | null;
  reason: string | null;
} {
  const pivot = asRecord(asRecord(payload)?.pivot);
  const dir = pivot?.direction;
  const direction = dir === "gained" || dir === "lost" ? dir : null;
  if (!direction) return { direction: null, reason: null };
  const reason =
    [str(pivot?.whatHappened), str(pivot?.whyItMattered)]
      .filter((x): x is string => x !== null)
      .join(" — ") || null;
  return { direction, reason };
}

type RawMoment = {
  sentiment?: string | null;
  note?: string | null;
  label?: string | null;
  customerLine?: string | null;
  isBreakdown?: boolean;
  kind?: string | null;
};

/** Parse the stored moments event payload ({ moments: SalesMoment[] }). Defensive:
 *  a non-array payload yields []. */
function readMoments(payload: unknown): RawMoment[] {
  const moments = asRecord(payload)?.moments;
  return Array.isArray(moments) ? (moments as RawMoment[]) : [];
}

/** Best manager-visible text for a moment, for the composed explanation. */
function momentText(m: RawMoment): string {
  return (m.note ?? m.label ?? m.customerLine ?? "").toString().trim();
}

/**
 * The single seam between STORAGE (event payloads) and the pure classifier. Extracts
 * the manager-visible signals from the raw pivot + moments payloads. Pure + tested so
 * a field-name drift in the stored shapes is caught here (not discovered as silent
 * "no flags ever appear" in production — the AMD-006 Layer-2 failure mode).
 */
export function extractSessionSignals(args: {
  outcome: string | null;
  pivotPayload: unknown;
  momentsPayload: unknown;
}): SessionSignals {
  const pivot = readPivot(args.pivotPayload);
  const moments = readMoments(args.momentsPayload);
  const breakdown = moments.find(
    (m) => m.isBreakdown === true || m.kind === "breakdown"
  );
  return {
    outcome: args.outcome,
    pivotDirection: pivot.direction,
    pivotReason: pivot.reason,
    sentiment: netSentimentFromMoments(moments),
    hasBreakdown: !!breakdown,
    breakdownText: breakdown ? momentText(breakdown) || null : null,
    coolingMoments: moments
      .filter((m) => m.sentiment === "cooling")
      .map(momentText)
      .filter(Boolean),
    warmingMoments: moments
      .filter((m) => m.sentiment === "warming")
      .map(momentText)
      .filter(Boolean),
  };
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
  // A negative INTERACTION: the call itself went wrong somewhere.
  const negativeInteraction =
    s.pivotDirection === "lost" ||
    s.sentiment === "cooling" ||
    s.hasBreakdown === true;
  // A negative OUTCOME: the interaction resulted in no sale. (Broadened
  // 2026-07-09 after v1 flagged almost nothing — the interaction signals above
  // exist only for finalized/summarized sessions, so `no_sale` is the
  // always-available signal that a session "resulted in a negative interaction".)
  const negativeOutcome = s.outcome === "no_sale";
  const negative = negativeInteraction || negativeOutcome;
  const positive =
    s.pivotDirection === "gained" || s.sentiment === "warming";

  // EXAMINATION — negative interaction OR negative outcome, any outcome otherwise.
  // Precedence: negative wins (a sale that went badly is examined, not celebrated).
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
    if (s.hasBreakdown) {
      reasons.push({
        label: "A breakdown moment",
        detail:
          s.breakdownText?.trim() ||
          "The call hit a point where it clearly went wrong.",
      });
    }
    reasons.push({
      label: "Outcome",
      detail:
        s.outcome === "sold"
          ? "Closed the sale — but the interaction still went poorly; worth examining how it landed despite the rough patch."
          : s.outcome === "no_sale"
            ? "No sale — the conversation didn't convert. Worth a manager's look at what happened."
            : outcomeLabel(s.outcome),
    });
    return {
      kind: "examination",
      headline:
        s.outcome === "sold"
          ? "Sold, but the prospect interaction went poorly — worth a look."
          : negativeInteraction
            ? "The prospect interaction went poorly — worth a manager's look."
            : "This call didn't convert — worth a manager's look at what happened.",
      reasons,
    };
  }

  // OUTSTANDING — closed the sale AND the interaction didn't go negative. A
  // positive signal (gained pivot / warming) strengthens the read but isn't
  // required, since those signals are only present on analyzed sessions and the
  // sale itself is evidence the interaction landed (founder: "closing deals AND
  // positive prospect interaction").
  if (s.outcome === "sold" && !negativeInteraction) {
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
      headline: positive
        ? "Closed the deal with a strong, positive prospect interaction."
        : "Closed the deal — a clean, positive result.",
      reasons,
    };
  }

  return null;
}
