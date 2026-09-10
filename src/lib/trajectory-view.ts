/**
 * Turning frozen monthly snapshots into a trend a rep can read.
 *
 * WHY A TREND IS WORTH ITS OWN SCREEN. The KPI board answers "where am I?". It
 * cannot answer "am I getting better?", which is the question a rep actually
 * has after a bad week — and the one a single number is least able to settle. A
 * conversion rate of 38% means nothing on its own; 38% after three months at 29%
 * means something.
 *
 * NO ARITHMETIC HAPPENS HERE, exactly as on the KPI board. A second copy of the
 * maths on the device is the drift the architecture forbids, and the server has already frozen each month
 * and computed each delta. This labels, orders and formats; nothing more.
 *
 * A NULL MONTH IS A REAL ANSWER. A month where a metric had too little evidence
 * comes back as null, and it is shown as a gap rather than as zero or as a line
 * drawn straight through it. A rep whose quiet December is rendered as a crash
 * to zero learns the wrong thing about their own year.
 */
import { formatValue, readableKey, type Unit } from '@/lib/kpi-view';
import type { MetricTrajectory, TrajectoryResponse } from '@/types/backend';

export type TrendPoint = {
  period: string;
  /** Ready to render, or null for a month with too little evidence. */
  display: string | null;
  /** 0–1 within the series' own range, for a sparkline. Null when there is no value. */
  fraction: number | null;
  sampleSize: number;
  /** "Mar 2026" — never "2026-03", which reads as a code rather than a month. */
  label: string;
};

export type TrendRow = {
  metric: string;
  label: string;
  unit: Unit;
  points: TrendPoint[];
  latest: string | null;
  /** Plain-language movement, or null when there is nothing honest to compare. */
  change: string | null;
  /** True when the metric has never resolved in any month. */
  building: boolean;
  monthsWithData: number;
};

export type TrendView = {
  /** True while too few months exist to show a trend at all. */
  building: boolean;
  monthsCovered: number;
  rows: TrendRow[];
};

/** Label and unit per metric, mirroring the KPI board so one metric never reads
 *  two different ways on two screens. */
const KNOWN: Record<string, { label: string; unit: Unit }> = {
  conversionRate: { label: 'Conversion rate', unit: 'percent' },
  closeRate: { label: 'Close rate', unit: 'percent' },
  winLossRatio: { label: 'Wins per loss', unit: 'ratio' },
  revenue: { label: 'Revenue', unit: 'money' },
  avgDealSize: { label: 'Average deal', unit: 'money' },
  quotaAttainment: { label: 'Quota attainment', unit: 'percent' },
  sessionsPerDay: { label: 'Calls per day', unit: 'perDay' },
  avgSessionDurationMin: { label: 'Average call length', unit: 'minutes' },
  salesCycleLength: { label: 'Sales cycle', unit: 'days' },
  objectionsPerSession: { label: 'Objections met per call', unit: 'count' },
  objectionResolutionRate: { label: 'Objections resolved', unit: 'percent' },
  followUpRate: { label: 'Prospects re-contacted', unit: 'percent' },
  recommendationUptake: { label: 'Recommendations taken up', unit: 'percent' },
  cueAcceptanceRate: { label: 'Coach cues acted on', unit: 'percent' },
  skillProgression: { label: 'Skill movement', unit: 'score' },
  consistency: { label: 'Call-to-call steadiness', unit: 'score' },
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * "Mar 2026" from "2026-03".
 *
 * Built from the string rather than a Date: constructing one from 'YYYY-MM'
 * parses as UTC midnight and can render as the PREVIOUS month for anyone west of
 * Greenwich. This app has already shipped that bug once, on session day
 * headings.
 */
export function periodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return period;
  return `${MONTHS[month - 1]} ${match[1]}`;
}

/**
 * The server's own month-over-month movement, said plainly.
 *
 * A11: it states the direction and stops. No verdict, no encouragement — a rep
 * knows whether their month was good, and a number that grades them is a number
 * they stop trusting.
 */
export function trendChange(t: MetricTrajectory, unit: Unit): string | null {
  if (t.delta === null || !Number.isFinite(t.delta)) return null;
  if (t.delta === 0) return 'Level with the month before';
  const size = formatValue(Math.abs(t.delta), unit);
  return `${t.delta > 0 ? 'Up' : 'Down'} ${size} on the month before`;
}

function toRow(t: MetricTrajectory): TrendRow {
  const known = KNOWN[t.metric];
  const unit: Unit = known?.unit ?? 'none';
  const label = known?.label ?? readableKey(t.metric);

  // The range is taken across the months that HAVE values. A series with one
  // value has no range, and every point in it sits at the top of the chart —
  // which would read as a perfect score rather than as a single data point.
  const values = t.points.map((p) => p.value).filter((v): v is number => v !== null);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const span = max - min;

  return {
    metric: t.metric,
    label,
    unit,
    latest: t.latest !== null ? formatValue(t.latest, unit) : null,
    change: trendChange(t, unit),
    building: t.monthsWithData === 0,
    monthsWithData: t.monthsWithData,
    points: t.points.map((p) => ({
      period: p.period,
      label: periodLabel(p.period),
      sampleSize: p.sampleSize,
      display: p.value !== null ? formatValue(p.value, unit) : null,
      // A flat series sits at mid-height rather than at zero or full: it did not
      // bottom out and it did not max out, it simply did not move.
      fraction:
        p.value === null ? null : span === 0 ? 0.5 : (p.value - min) / span,
    })),
  };
}

export function buildTrendView(res: TrajectoryResponse): TrendView {
  const metrics = res?.metrics ?? [];
  return {
    building: res?.building !== false,
    monthsCovered: res?.monthsCovered ?? 0,
    // Metrics that have never resolved sink to the bottom rather than being
    // dropped: a rep should be able to see that a measurement exists and is
    // still gathering, which is different from it not existing.
    rows: metrics
      .map(toRow)
      .sort((a, b) =>
        a.building === b.building ? a.label.localeCompare(b.label) : a.building ? 1 : -1,
      ),
  };
}
