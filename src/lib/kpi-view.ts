/**
 * Turning the server's KPI response into rows a rep can read.
 *
 * THE ONE RULE THIS FILE OBEYS: it does no arithmetic on a metric's value. The
 * server computes; the device displays. 01-INTEGRATION-ARCHITECTURE.md states the rule as
 * "consume the verdict, don't re-derive it"; a second copy of the formula is the
 * drift it warns about, and the server's own
 * compute already carries fixes a device copy would not have — a duration
 * outlier bug among them. So every number here is passed through exactly as it
 * arrived, and the only decisions made are how to LABEL it and which unit
 * symbol to put beside it.
 *
 * WHERE THE UNITS COME FROM. Not from a guess, and not from the response, which
 * carries none: they were read out of the server's own compute
 * (src/lib/coach/kpi/compute.ts in TeamPilot), function by function. That matters
 * because the rate metrics are ALREADY multiplied by 100 there — treating one as
 * a 0–1 fraction here would render a 42% conversion rate as "4200%".
 *
 * A METRIC THIS FILE DOES NOT KNOW IS STILL SHOWN. The server owns the metric
 * set and can add to it; dropping an unrecognised key would mean the app quietly
 * hides a number the rep is being measured on. Unknown keys are rendered with a
 * readable version of their key and no unit invented for them.
 *
 * "BUILDING" IS NOT ZERO. A gated metric has value null because the sample is
 * too small to say anything honest. It is shown as building, with how far along
 * it is — never as a 0, and never omitted, because a rep needs to know the
 * measurement exists and what will make it appear.
 */
import type { KpiResponse, MetricResult } from '@/types/backend';

export type Unit = 'percent' | 'money' | 'ratio' | 'minutes' | 'days' | 'perDay' | 'score' | 'count' | 'none';

export type MetricRow = {
  key: string;
  label: string;
  /** Ready to render. Null only when the metric is building. */
  display: string | null;
  gated: boolean;
  sampleSize: number;
  /** How many more samples the metric needs, or null when it is not gated. */
  needed: number | null;
  /** The self-comparison, already computed by the server, phrased for reading. */
  change: string | null;
  unit: Unit;
  /** How many sessions fed this number. */
  sourceCount: number;
  /**
   * The calls behind the number, newest first.
   *
   * A11 says this board mirrors rather than judges — and the strongest form of
   * that is letting a rep check the figure against the calls that made it. A
   * conversion rate a rep cannot inspect is something they have to take on
   * trust; one they can open is evidence.
   *
   * Built from ids the metric already carries and the session map the response
   * already sends, so showing it costs no extra request.
   */
  sources: MetricSource[];
};

export type MetricSource = {
  id: string;
  label: string | null;
  startedAt: string;
  outcome: string | null;
};

export type KpiView = {
  /** True while the whole board is below the Understanding Gate. */
  building: boolean;
  sessionCount: number;
  /**
   * How many of the rep's sessions have no outcome recorded.
   *
   * This is the missing explanation behind a board that will not fill in.
   * Conversion rate is sold divided by opportunities, close rate is won divided
   * by resolved — a session with no outcome feeds neither. A rep can be selling
   * steadily and still see "building" everywhere, with nothing on screen
   * connecting the two.
   *
   * Read from the `sessions` map the response already carries, so saying it
   * costs no extra request.
   */
  unscoredCount: number;
  minSessions: number;
  scope: 'self' | 'company';
  /** The headline numbers, in the order a rep reads them. */
  headline: MetricRow[];
  /** Everything else the server sent, in a stable order. */
  rest: MetricRow[];
};

/** Label and unit per metric key, read off the server's compute. */
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
  cueToOutcome: { label: 'Cues and wins, together', unit: 'ratio' },
  relianceReduction: { label: 'Change in coach reliance', unit: 'none' },
  skillProgression: { label: 'Skill movement', unit: 'score' },
  consistency: { label: 'Call-to-call steadiness', unit: 'score' },

  l2_talk_ratio: { label: 'Talk ratio', unit: 'score' },
  l3_opener: { label: 'Opener', unit: 'score' },
  l3_objection: { label: 'Handling objections', unit: 'score' },
  l3_tone: { label: 'Tone', unit: 'score' },
  l3_close: { label: 'Closing', unit: 'score' },
  l3_question_rate: { label: 'Asking questions', unit: 'score' },
  l3_next_step: { label: 'Setting the next step', unit: 'score' },
};

/** The order a rep reads them in: outcome first, then money, then activity. */
const HEADLINE = [
  'conversionRate',
  'closeRate',
  'winLossRatio',
  'revenue',
  'avgDealSize',
  'quotaAttainment',
  'sessionsPerDay',
  'avgSessionDurationMin',
];

/** A key the server invented that this build has never seen, made readable. */
export function readableKey(key: string): string {
  const stripped = key.replace(/^l[23]_/, '');
  // Sentence case, to match every hand-written label above. Title Case On An
  // Unknown Key would make the one metric the app does not recognise the loudest
  // thing on the board.
  const spaced = stripped
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Thousands separators without inventing precision the server did not send. */
function group(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatValue(value: number, unit: Unit): string {
  switch (unit) {
    // Already multiplied by 100 on the server. Do not scale it again.
    case 'percent':
      return `${group(value)}%`;
    case 'money':
      return `$${group(value)}`;
    case 'ratio':
      return group(value);
    case 'minutes':
      return `${group(value)} min`;
    case 'days':
      return value === 1 ? '1 day' : `${group(value)} days`;
    case 'perDay':
      return `${group(value)} a day`;
    case 'score':
      return `${group(value)} / 100`;
    case 'count':
    case 'none':
    default:
      return group(value);
  }
}

/**
 * The server's own recent-half vs prior-half comparison, said plainly.
 *
 * A11: this states the movement and stops. It does not call a fall a problem or
 * a rise a win — the rep knows their week, and a number that grades them is a
 * number they stop trusting.
 */
export function formatChange(delta: number | null | undefined, unit: Unit): string | null {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null;
  if (delta === 0) return 'Unchanged since the first half of these calls';

  const size = formatValue(Math.abs(delta), unit === 'money' ? 'money' : unit);
  const direction = delta > 0 ? 'Up' : 'Down';
  return `${direction} ${size} since the first half of these calls`;
}

function toRow(
  key: string,
  metric: MetricResult,
  delta: number | null | undefined,
  minSessions: number,
  sessions: KpiResponse['sessions'],
): MetricRow {
  const known = KNOWN[key];
  const unit: Unit = known?.unit ?? 'none';
  const label = known?.label ?? readableKey(key);

  // Gated, or a value the server could not produce: both mean "building". A
  // number is only shown when the server actually sent one.
  const hasValue = !metric.gated && metric.value !== null && Number.isFinite(metric.value);

  return {
    key,
    label,
    display: hasValue ? formatValue(metric.value as number, unit) : null,
    gated: !hasValue,
    sampleSize: metric.sampleSize,
    needed: hasValue ? null : Math.max(0, minSessions - metric.sampleSize),
    change: hasValue ? formatChange(delta, unit) : null,
    unit,
    sourceCount: metric.sourceSessionIds?.length ?? 0,
    // An id the session map does not describe is dropped rather than shown as a
    // blank row: the count above still reports it, so the rep is not told the
    // metric used fewer calls than it did.
    sources: (metric.sourceSessionIds ?? [])
      .map((id) => {
        const s = sessions?.[id];
        return s ? { id, label: s.label, startedAt: s.startedAt, outcome: s.outcome } : null;
      })
      .filter((s): s is MetricSource => s !== null)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  };
}

export function buildKpiView(res: KpiResponse): KpiView {
  const minSessions = res.minSessions ?? 5;
  const sessions = res.sessions ?? {};
  const metrics = res.metrics ?? {};
  const deltas = res.deltas ?? {};

  const rowFor = (key: string) => toRow(key, metrics[key], deltas[key], minSessions, sessions);

  const headline = HEADLINE.filter((k) => metrics[k]).map(rowFor);

  // Everything the server sent that is not a headline, in a stable order so the
  // board does not reshuffle between loads.
  const rest = Object.keys(metrics)
    .filter((k) => !HEADLINE.includes(k))
    .sort((a, b) => (KNOWN[a]?.label ?? a).localeCompare(KNOWN[b]?.label ?? b))
    .map(rowFor);

  const unscoredCount = Object.values(sessions).filter((s) => !s?.outcome).length;

  return {
    building: res.sessionCount < minSessions,
    sessionCount: res.sessionCount ?? 0,
    unscoredCount,
    minSessions,
    scope: res.scope === 'company' ? 'company' : 'self',
    headline,
    rest,
  };
}
