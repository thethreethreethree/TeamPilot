/**
 * Turning the team roster into rows a manager can read.
 *
 * NO ARITHMETIC, exactly as on the KPI board and the trend. The server computes
 * every metric and decides who is slipping against their own baseline, and a
 * second copy of that judgement here would be the drift the architecture forbids. This labels, orders and formats.
 *
 * A11 APPLIES DOUBLY HERE, because this screen is about PEOPLE. The board
 * mirrors a rep's own numbers back to them; this one shows a manager somebody
 * else's. So the wording states what happened and stops: "down against their own
 * recent months" is a fact the server measured. "Underperforming" would be a
 * verdict on a person that neither the server nor this app is entitled to reach,
 * and a manager who opens a conversation with that has already lost it.
 *
 * "SLIPPING" IS ALWAYS AGAINST THEMSELVES. The server compares a rep to their
 * own baseline, never to the team. That distinction is the difference between a
 * useful prompt and a leaderboard, and the copy has to carry it — a manager
 * reading it as a ranking will act on it as one.
 */
import { formatValue, type Unit } from '@/lib/kpi-view';
import type { MetricResult, TeamAgent, TeamResponse } from '@/types/backend';

export type TeamMetric = {
  label: string;
  /** Ready to render, or null while the metric is still building. */
  display: string | null;
  building: boolean;
  sampleSize: number;
};

export type TeamRow = {
  agentId: string;
  /** Never empty: a nameless profile still has to be identifiable in a list. */
  name: string;
  sessionCount: number;
  /** True while there are too few calls for a comparison to mean anything. */
  establishingBaseline: boolean;
  slipping: boolean;
  /** Plain-language reasons, or null when nothing is slipping. */
  slippingNote: string | null;
  conversion: TeamMetric;
  quota: TeamMetric;
};

export type TeamView = {
  rows: TeamRow[];
  /** The drop the server treats as slipping, for saying so once on screen. */
  alertDropPct: number;
  monthlyQuotaTarget: number;
  /** How many reps the server flagged. */
  slippingCount: number;
};

function metric(label: string, m: MetricResult | undefined, unit: Unit): TeamMetric {
  // Same rule as the KPI board: a number is shown only when the server sent one.
  // `gated` and a null value both mean "not enough evidence", and printing 0
  // there would report a rep as converting nothing.
  const hasValue = Boolean(m) && !m!.gated && m!.value !== null && Number.isFinite(m!.value);
  return {
    label,
    display: hasValue ? formatValue(m!.value as number, unit) : null,
    building: !hasValue,
    sampleSize: m?.sampleSize ?? 0,
  };
}

/** "conversion" and "quality" from the server, said as a manager would say them. */
const REASON_LABEL: Record<string, string> = {
  conversion: 'closing fewer',
  quality: 'call quality',
};

export function slippingNote(agent: TeamAgent): string | null {
  if (!agent.slipping || agent.slippingReasons.length === 0) return null;
  const reasons = agent.slippingReasons.map((r) => REASON_LABEL[r] ?? r);
  const list =
    reasons.length === 1 ? reasons[0] : `${reasons.slice(0, -1).join(', ')} and ${reasons.at(-1)}`;
  // "their own recent months" is load-bearing: it is a self-comparison, not a
  // ranking against the team, and a manager who reads it as a ranking will use
  // it as one.
  return `Down on their own recent months — ${list}.`;
}

export function buildTeamView(res: TeamResponse): TeamView {
  const agents = res?.agents ?? [];

  const rows = agents.map((a) => ({
    agentId: a.agentId,
    name: a.name?.trim() || 'Unnamed rep',
    sessionCount: a.sessionCount ?? 0,
    establishingBaseline: a.establishingBaseline === true,
    // A rep still establishing a baseline is never shown as slipping: there is
    // nothing to have slipped from, and flagging them would put a manager on to
    // someone whose only fault is being new.
    slipping: a.slipping === true && a.establishingBaseline !== true,
    slippingNote: a.establishingBaseline === true ? null : slippingNote(a),
    conversion: metric('Conversion rate', a.conversionRate, 'percent'),
    quota: metric('Quota attainment', a.quotaAttainment, 'percent'),
  }));

  return {
    // Anyone the server flagged comes first — that is the whole reason a manager
    // opens this. Everyone else keeps the server's own order, which is org rank.
    rows: [...rows].sort((a, b) => (a.slipping === b.slipping ? 0 : a.slipping ? -1 : 1)),
    alertDropPct: res?.alertDropPct ?? 0,
    monthlyQuotaTarget: res?.monthlyQuotaTarget ?? 0,
    slippingCount: rows.filter((r) => r.slipping).length,
  };
}
