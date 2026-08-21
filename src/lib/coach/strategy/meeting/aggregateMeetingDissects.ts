/**
 * Pure aggregation of meeting-dissect events into a "did meetings improve?" TREND (Phase-6; §3.6 make-learning-
 * visible). Because meeting cues run day-1 (controlExempt) there is NO control-month baseline — so improvement
 * can only be a TREND over a team's OWN history, never a before/after. This compares the team's RECENT half of
 * meetings against its EARLIER half on the consequence signals the dissect measures.
 *
 * §3.4/§3.6 honesty: a trend needs enough data to be real. Below MIN_FOR_TREND meetings the direction is
 * "insufficient" — we do NOT manufacture an improvement curve from two data points. Defensive: dissect payloads
 * are stored events, so a shape drift degrades to zero-extracted, never throws.
 *
 * Direction is read from the two clearest QUALITY ratios — owned-action ratio (owner-less actions are the #1
 * meeting failure) and focused ratio — moving together: both up (beyond a tolerance) = improving, both down =
 * declining, otherwise flat. Raw counts (decisions/meeting, open-items/meeting) are reported but not used for
 * direction, since "more decisions" isn't unambiguously better the way "more actions get owners" is.
 */
export type MeetingDissectRow = { payload: unknown; created_at: unknown };

export type MeetingMetrics = {
  meetings: number;
  decisionsPerMeeting: number;
  ownedActionRatio: number | null; // owned / total actions; null when no actions were recorded
  focusedRatio: number | null; // focused / meetings-with-an-effectiveness-read; null when none recorded
  openItemsPerMeeting: number;
};

export type MeetingTrend = {
  overall: MeetingMetrics;
  recent: MeetingMetrics | null;
  earlier: MeetingMetrics | null;
  direction: "improving" | "flat" | "declining" | "insufficient";
  lastAt: string | null;
};

const MIN_FOR_TREND = 4; // fewer than this → "insufficient"; don't fake a curve
const TOLERANCE = 0.05; // a ratio must move more than this to count as a real change

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function metricsFor(payloads: Record<string, unknown>[]): MeetingMetrics {
  let decisions = 0;
  let actions = 0;
  let owned = 0;
  let openItems = 0;
  let focused = 0;
  let effRecorded = 0;
  for (const p of payloads) {
    decisions += asArray(p.decisions).length;
    const acts = asArray(p.actions);
    actions += acts.length;
    owned += acts.filter((a) => {
      const o = asRecord(a).owner;
      return typeof o === "string" && o.length > 0;
    }).length;
    // Payloads store snake_case open_items; tolerate camelCase too.
    openItems += (Array.isArray(p.open_items) ? p.open_items : asArray(p.openItems)).length;
    const eff = asRecord(p.effectiveness);
    if (typeof eff.focused === "boolean") {
      effRecorded += 1;
      if (eff.focused) focused += 1;
    }
  }
  const n = payloads.length;
  return {
    meetings: n,
    decisionsPerMeeting: n ? decisions / n : 0,
    ownedActionRatio: actions ? owned / actions : null,
    focusedRatio: effRecorded ? focused / effRecorded : null,
    openItemsPerMeeting: n ? openItems / n : 0,
  };
}

/** Rows arrive newest-first (created_at desc). */
export function aggregateMeetingDissects(rows: MeetingDissectRow[]): MeetingTrend {
  const list = rows ?? [];
  const payloads = list.map((r) => asRecord(r?.payload));
  const lastAt =
    list.find((r) => typeof r?.created_at === "string")?.created_at as string | undefined;

  const overall = metricsFor(payloads);

  if (payloads.length < MIN_FOR_TREND) {
    return { overall, recent: null, earlier: null, direction: "insufficient", lastAt: lastAt ?? null };
  }

  // Split newest-first into recent (front) half and earlier (back) half.
  const mid = Math.floor(payloads.length / 2);
  const recent = metricsFor(payloads.slice(0, mid));
  const earlier = metricsFor(payloads.slice(mid));

  // Direction from the two quality ratios moving together (missing ratio counts as no-change on that axis).
  const delta = (a: number | null, b: number | null): number =>
    a === null || b === null ? 0 : a - b;
  const owned = delta(recent.ownedActionRatio, earlier.ownedActionRatio);
  const focus = delta(recent.focusedRatio, earlier.focusedRatio);
  const up = (d: number) => d > TOLERANCE;
  const down = (d: number) => d < -TOLERANCE;

  let direction: MeetingTrend["direction"] = "flat";
  if ((up(owned) && !down(focus)) || (up(focus) && !down(owned))) direction = "improving";
  else if ((down(owned) && !up(focus)) || (down(focus) && !up(owned))) direction = "declining";

  return { overall, recent, earlier, direction, lastAt: lastAt ?? null };
}
