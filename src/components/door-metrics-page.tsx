/**
 * Today's Metrics — the door-to-door field read, on the phone.
 *
 * One of the two door-to-door tabs the owner's web app shows in Macro Mode, and
 * the one a rep checks between streets: how many doors, how many conversations,
 * how many sales, how the pitches are scoring, and the one habit worth drilling
 * next.
 *
 * MIRRORS `components/sales-coach/doorlog/TodaysMetrics.tsx`: period tabs, a KPI
 * trio with the sales figure accented, a score chart, the Next Door focus, and
 * growth opportunities — in that order, because that is the order a rep reads
 * them in and the order the web already teaches.
 *
 * BARS ARE NEVER THE ONLY CHANNEL. Every score is written as a number beside its
 * bar. A bar alone is unreadable to a screen reader and unmeasurable in bright
 * sun, which is where this screen is used.
 *
 * A MISSING DIMENSION IS ABSENT, NOT ZERO — see metrics-view.ts. A rep reading a
 * zero for "Questions" would conclude they never ask any, when nothing was ever
 * measured.
 *
 * IT IS A PAGE, NOT A SCREEN (spec §1). Today's Metrics is one module with two
 * swipeable pages — the Arena first, this second — so the shell, the safe-area
 * insets and the toggle belong to the pager above it. This owns its own vertical
 * scroll and nothing else, which is what lets a rep scroll it without the swipe
 * stealing the gesture.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { fetchMetrics } from '@/lib/doors/metrics-api';
import {
  buildMetricsView,
  PERIODS,
  SCORE_MAX,
  type Metrics,
  type MetricsPeriod,
} from '@/lib/doors/metrics-view';
import {
  CUSTOM_CHIP,
  RANGE_MALFORMED,
  RANGE_NO_PATTERN,
  RANGE_NOT_HONOURED,
  RANGE_PROMPT,
  RANGE_REVERSED,
  rangeLabel,
  rangeProblem,
  type DateRange,
} from '@/lib/doors/metrics-range';
import { dayLabel } from '@/lib/doors/calendar';
import { DateField } from '@/components/date-field';
import { localDate } from '@/lib/doors/knock-store';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { blockedState } from '@/lib/blocked-state';
import { useLargeText } from '@/lib/use-large-text';
import { FOCUS_HEADING, FOCUS_HINT, FOCUS_PENDING } from '@/lib/doors/door-screen-view';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', "today's doors");

type Phase = 'loading' | 'ready' | 'needs-shim' | 'error';

export function DoorMetricsPage() {
  const stacked = useLargeText();
  const router = useRouter();
  const [period, setPeriod] = useState<MetricsPeriod>('day');
  /** True once the rep opens the Custom chip. The fields show; nothing is sent. */
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  /**
   * The range actually being SHOWN, which is not the same as the one being
   * typed. A rep half-way through choosing an end date has a nonsense window on
   * screen for a moment, and refetching on every tap would caption the numbers
   * with it. Nothing is sent until they press Show.
   */
  const [applied, setApplied] = useState<DateRange | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: MetricsPeriod | DateRange) => {
    const result = await fetchMetrics(p);
    if (result.ok) {
      setMetrics(result.metrics);
      setPhase('ready');
      return;
    }
    // The previous period's figures are NOT left on screen under a new tab's
    // label — that would attribute one period's numbers to another.
    setMetrics(null);
    // A rep whose session expired must not be shown the route-refusal paragraph: signing in again is exactly what
    // fixes their case, and the shared copy for a route refusal says the opposite. The verdict is the one
    // coach-api already worked out after its own refresh attempt.
    if (result.reason === 'needs-shim' && result.why === 'signed-out') {
      setPhase('error');
      setMessage(authFailureMessage('signed-out'));
      return;
    }
    // A range the server did not honour is NOT a failure the rep caused and not
    // one a retry fixes silently: the route answers a reversed or malformed
    // window with 200 and TODAY's figures. Saying so plainly is the only thing
    // between the rep and eight doors captioned as ten days' work.
    if (result.reason === 'range-not-honoured') {
      setPhase('error');
      setMessage(RANGE_NOT_HONOURED);
      return;
    }
    setPhase(result.reason === 'needs-shim' ? 'needs-shim' : 'error');
    setMessage(result.reason === 'failed' ? (result.message ?? null) : null);
  }, []);

  /**
   * What is on screen: the applied range if there is one, else the preset.
   *
   * MEMOISED because it feeds the focus effect. A fresh object every render
   * would re-run the effect every render, which is a refetch loop on a screen
   * that refetches over the network.
   */
  const shown = useMemo<MetricsPeriod | DateRange>(() => applied ?? period, [applied, period]);

  useFocusEffect(
    useCallback(() => {
      load(shown);
    }, [load, shown]),
  );

  const view = buildMetricsView(metrics);
  const periodLabel = PERIODS.find((p) => p.key === period)?.label.toLowerCase() ?? 'period';
  // "this 25 Aug 2026 to 4 Sep 2026" is not English. A window gets its own phrase.
  const windowPhrase = applied ? 'in that date range' : `this ${periodLabel}`;
  const problem = rangeProblem(from, to);
  const rangeHint =
    problem === 'incomplete'
      ? RANGE_PROMPT
      : problem === 'reversed'
        ? RANGE_REVERSED
        : problem === 'malformed'
          ? RANGE_MALFORMED
          : null;
  const today = localDate();

  return (
    <>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        // flex-1 so the scroll fills its pane in the pager. It used to sit directly inside a SafeAreaView that
        // supplied the height; as a page in a horizontal track it has to claim its own, or the list sizes to its
        // content and stops scrolling where the content happens to end. Nothing in a build catches that.
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load(shown);
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={C['muted-foreground']}
          />
        }
      >
        {/* Period tabs. Words, not a segmented glyph — a rep must be able to see
            which one is on without decoding a highlight. */}
        <View className="mt-4 flex-row gap-2">
          {PERIODS.map((p) => {
            const on = p.key === period;
            return (
              <Pressable
                key={p.key}
                onPress={() => {
                  setPeriod(p.key);
                  // A preset REPLACES the window. Leaving the applied range in
                  // place would show the range's numbers under the preset's
                  // highlight, which is the same lie in the other direction.
                  setApplied(null);
                  setCustomOpen(false);
                  setPhase('loading');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Show the ${p.label.toLowerCase()}`}
                className={`min-h-7 flex-1 items-center justify-center rounded-md border px-2 py-2 active:opacity-70 ${
                  on ? 'border-primary bg-surface' : 'border-border-control'
                }`}
              >
                <Text
                  className={`font-emphasis text-sm ${on ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/*
          CUSTOM SITS ON ITS OWN ROW, not as a fifth chip in the row above.

          Five chips at equal width leave "All time" about fifty points to render
          in, and at an accessibility text size it clips rather than wraps —
          which no layout check sees. Its own full-width row also gives the two
          date fields somewhere to open into, directly under the control that
          reveals them.
        */}
        <Pressable
          onPress={() => setCustomOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ selected: applied !== null, expanded: customOpen }}
          accessibilityLabel={
            applied
              ? `Custom date range, showing ${rangeLabel(applied, dayLabel)}`
              : 'Choose a custom date range'
          }
          className={`mt-2 min-h-7 items-center justify-center rounded-md border px-2 py-2 active:opacity-70 ${
            applied !== null ? 'border-primary bg-surface' : 'border-border-control'
          }`}
        >
          <Text
            className={`font-emphasis text-sm ${
              applied !== null ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {applied ? rangeLabel(applied, dayLabel) : CUSTOM_CHIP}
          </Text>
        </Pressable>

        {customOpen ? (
          <View>
            {/*
              STACKED, NEVER SIDE BY SIDE, and it is a measurement rather than a
              taste. Two calendars sharing a phone's width leave each grid about
              165 points for seven columns — a 23-point day cell, half the 44pt
              floor the design law sets for any interactive control. Full width
              gives each day about 50 points, which is a real target.
            */}
            <DateField label="From" value={from} today={today} onChange={setFrom} />
            <DateField label="To" value={to} today={today} onChange={setTo} />

            {/* "Pick a start and an end date" is the ORDINARY state between
                opening this and choosing the second day — said in the muted
                voice, never as an error. Only a reversed or impossible date is
                shown as a fault, and it is the rep's to fix. */}
            {rangeHint ? (
              <Text
                accessibilityLiveRegion="polite"
                className={`mt-3 font-body text-sm leading-relaxed ${
                  problem === 'incomplete' ? 'text-muted-foreground' : 'text-destructive'
                }`}
              >
                {rangeHint}
              </Text>
            ) : null}

            <Pressable
              onPress={() => {
                if (problem !== null || !from || !to) return;
                setApplied({ from, to });
                setPhase('loading');
              }}
              disabled={problem !== null}
              accessibilityRole="button"
              accessibilityLabel="Show the door numbers for this date range"
              accessibilityState={{ disabled: problem !== null }}
              style={problem !== null ? { opacity: 0.5 } : undefined}
              className="mt-3 min-h-7 items-center justify-center rounded-md bg-primary px-4 active:opacity-80"
            >
              <Text className="font-emphasis text-base text-primary-foreground">Show</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'loading' ? (
          <View className="mt-16 items-center">
            <ActivityIndicator color={C.primary} accessibilityLabel="Loading your metrics" />
          </View>
        ) : null}

        {phase === 'needs-shim' ? (
          <View className="mt-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              {BLOCKED.title}
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {BLOCKED.body}
            </Text>
            <Text className="mt-3 font-body text-base leading-relaxed text-muted-foreground">
              Doors you log in the app are kept safely on this phone in the meantime.
            </Text>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View
            // The load failed and this replaced the screen. A sighted rep sees
            // the swap; without this a screen-reader user is told nothing at all.
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-6"
          >
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Could not load your metrics
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {message ?? 'Check your connection and pull down to try again.'}
            </Text>
          </View>
        ) : null}

        {phase === 'ready' ? (
          <>
            <View className="mt-4 flex-row gap-3">
              {view.kpi.map((k) => (
                <View
                  key={k.key}
                  accessible
                  accessibilityLabel={k.spoken}
                  className={`flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-3 ${
                    k.emphasis ? 'border-primary bg-surface' : 'border-border-control'
                  }`}
                >
                  <Text
                    className={`font-heading text-2xl tabular-nums ${
                      k.emphasis ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {k.value}
                  </Text>
                  <Text className="text-center font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
                    {k.label}
                  </Text>
                </View>
              ))}
            </View>

            <Heading>Score chart</Heading>
            {view.noScores ? (
              <View className="gap-3">
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                No scored pitches yet {windowPhrase}. The chart fills in as your recorded
                pitches get analysed.
              </Text>
              {/* The action, not only the explanation — copy.md. */}
              <Pressable
                onPress={() => router.push('/(app)/record')}
                accessibilityRole="button"
                accessibilityLabel="Record a call"
                className="mt-3 min-h-7 justify-center self-start rounded-md border border-primary px-4 py-3 active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">Record a call</Text>
              </Pressable>
              </View>
            ) : (
              <View className="gap-3">
                {view.bars.map((b) => (
                  <View key={b.key} accessible accessibilityLabel={b.spoken}>
                    {/* Neither of these carries flex-1, so at an accessibility
                        text size a long label can push the number out of the
                        row entirely — the figure disappears rather than wraps,
                        and no layout check sees an overflow. Stacked above the
                        threshold, both survive at any size. */}
                    <View
                      className={
                        stacked
                          ? 'gap-0.5'
                          : 'flex-row items-baseline justify-between gap-3'
                      }
                    >
                      <Text className="font-body text-base text-foreground">{b.label}</Text>
                      {/* The number, always. A bar on its own cannot be read
                          aloud and cannot be measured in bright sun. */}
                      <Text className="font-strong text-base tabular-nums text-foreground">
                        {b.value} / {SCORE_MAX}
                      </Text>
                    </View>
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no"
                      className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-surface-raised"
                    >
                      <View
                        className="h-full rounded-sm bg-primary"
                        style={{ width: `${b.fraction * 100}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Heading>{FOCUS_HEADING}</Heading>
            {view.focus ? (
              <>
                <Text className="font-body text-base leading-relaxed text-foreground">
                  {view.focus}
                </Text>
                <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
                  {FOCUS_HINT}
                </Text>
              </>
            ) : applied ? (
              /* The focus is not MISSING under a range, it is not computed for
                 one — see RANGE_NO_PATTERN. "Once a few pitches have been
                 analysed" would be a flat lie to a rep with two hundred. */
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                {RANGE_NO_PATTERN}
              </Text>
            ) : (
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                {FOCUS_PENDING}
              </Text>
            )}

            {view.opportunities.length > 0 ? (
              <>
                <Heading>Growth opportunities</Heading>
                <View className="gap-2">
                  {view.opportunities.map((o) => (
                    <Text
                      key={o}
                      className="font-body text-base leading-relaxed text-muted-foreground"
                    >
                      {o}
                    </Text>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="mb-2 mt-7 font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
    >
      {children}
    </Text>
  );
}
