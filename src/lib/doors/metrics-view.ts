import { count } from '@/lib/format';
/**
 * Today's Metrics, shaped for the screen.
 *
 * MIRRORS THE WEB'S OWN COMPONENT, read rather than remembered
 * (`components/sales-coach/doorlog/TodaysMetrics.tsx`): a KPI trio, a score
 * chart over five named dimensions, a "next door" focus, and growth
 * opportunities — over Day / Week / Month / All Time.
 *
 * THE ONE RULE WORTH COPYING VERBATIM is the web's own comment on the score
 * chart: *"Only dims PRESENT in the data render (older pitches scored under the
 * v1 rubric lack talk_listen/questions — showing a phantom 0 would be a lie)."*
 * A rep looking at a zero for "Questions" would conclude they never ask any,
 * when in fact nothing was ever measured. So a missing dimension is ABSENT here,
 * never zero, and that is enforced by a test rather than by memory.
 *
 * WHY THE VIEW IS PURE. The score chart's bars are proportions, and a proportion
 * computed in a component is one nobody can check. Everything the screen draws
 * is decided here.
 */

/** The founder's five dimensions, in the order the web renders them. */
export const SCORE_ORDER = ['objection', 'talk_listen', 'questions', 'tone', 'close'] as const;

export const SCORE_LABEL: Record<string, string> = {
  objection: 'Objection',
  talk_listen: 'Talk / listen',
  questions: 'Questions',
  tone: 'Tone',
  close: 'Close',
};

export type MetricsPeriod = 'day' | 'week' | 'month' | 'all_time';

export const PERIODS: { key: MetricsPeriod; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all_time', label: 'All time' },
];

/** Exactly what the route returns, alongside `period`. */
export type Metrics = {
  kpi: { doorsKnocked: number; conversations: number; sold: number };
  scores: Record<string, number>;
  focus: string | null;
  opportunities: string[];
};

export type ScoreBar = {
  key: string;
  label: string;
  /** The score as the server gave it. */
  value: number;
  /** 0–1, for the bar's width. */
  fraction: number;
  spoken: string;
};

export type MetricsView = {
  kpi: { key: string; label: string; value: string; emphasis?: boolean; spoken: string }[];
  bars: ScoreBar[];
  focus: string | null;
  opportunities: string[];
  /** True when there is genuinely nothing scored yet for this period. */
  noScores: boolean;
};

/**
 * The scale the scores are on.
 *
 * Ten, because the web's own chart renders `value / 10` widths. Stated as a
 * constant rather than inlined so that if the rubric ever changes there is one
 * place to change and one place to read.
 */
export const SCORE_MAX = 10;

/** Em dash, never a zero, for a figure that could not be read. */
function figure(n: number | null | undefined): string {
  // Grouped: the All Time tab shows a figure that runs to five digits.
  return n === null || n === undefined || !Number.isFinite(n) ? '—' : count(n);
}

export function buildMetricsView(metrics: Metrics | null): MetricsView {
  const kpi = [
    {
      key: 'doors',
      label: 'Doors knocked',
      value: figure(metrics?.kpi?.doorsKnocked),
      spoken: metrics
        ? `${metrics.kpi.doorsKnocked} doors knocked`
        : 'Doors knocked could not be read',
    },
    {
      key: 'conversations',
      label: 'Conversations',
      value: figure(metrics?.kpi?.conversations),
      spoken: metrics
        ? `${metrics.kpi.conversations} conversations`
        : 'Conversations could not be read',
    },
    {
      key: 'sold',
      label: 'Sales',
      value: figure(metrics?.kpi?.sold),
      // The web accents this one. It is also the only figure here a rep can
      // move today, which is the same reason.
      emphasis: Boolean(metrics && metrics.kpi.sold > 0),
      spoken: metrics ? `${metrics.kpi.sold} sales` : 'Sales could not be read',
    },
  ];

  const scores = metrics?.scores ?? {};
  const bars: ScoreBar[] = SCORE_ORDER
    // PRESENT, not truthy. A genuine score of 0 is a real measurement and must
    // render; a dimension that was never scored must not. `?? undefined` would
    // have collapsed those two into one and silently hidden a real zero.
    .filter((key) => Object.prototype.hasOwnProperty.call(scores, key))
    .filter((key) => Number.isFinite(scores[key]))
    .map((key) => {
      const value = scores[key];
      return {
        key,
        label: SCORE_LABEL[key] ?? key,
        value,
        fraction: Math.max(0, Math.min(1, value / SCORE_MAX)),
        spoken: `${SCORE_LABEL[key] ?? key}: ${value} out of ${SCORE_MAX}`,
      };
    });

  return {
    kpi,
    bars,
    focus: metrics?.focus?.trim() || null,
    opportunities: (metrics?.opportunities ?? []).filter((o) => o && o.trim().length > 0),
    noScores: bars.length === 0,
  };
}
