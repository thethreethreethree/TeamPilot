/**
 * Breakdown — the rep's rubric averages for the period (mockup p2).
 *
 * BUILT BEFORE PROGRESS, against the order the boards are drawn in, because this screen carries the
 * launch checklist's reconciliation: *"sections sum to base; base + bonus − violations = avg
 * score"*. If that identity fails, every number on the Progress gauge is wrong too — and the gauge
 * is the last place anyone would notice. Build the screen that can fail loudly first.
 *
 * IT SAYS WHAT IT COUNTS. The founder ruled on 2026-09-22 that both scoring systems stand, each
 * naming what it measures. A rep can reach the gamification Arena one segment away, where "points"
 * means something else entirely and runs 0-100 rather than 0-130. Every total on this board is
 * therefore labelled as a Pitch Score, not as points.
 *
 * A FAILED READ IS NEVER A ZERO. This app has caught that five times, most recently on the Arena,
 * where a failed leaderboard read told a rep they had closed no deals on the one screen entirely
 * about their own performance. Each read here has three outcomes — figures, nothing yet, or could
 * not be read — and the third is never drawn as the second.
 *
 * THE 'RUBRIC' BUTTON ARRIVED WITH THE SHEET IT OPENS, not before it. While the sheet did not exist
 * this board shipped without the button, because a control that opens nothing teaches a rep the app
 * is broken — the exact shape this codebase spent the week removing.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { PitchPeriodToggle } from '@/components/pitch-period-toggle';
import { PitchRubricSheet } from '@/components/pitch-rubric-sheet';
import { fetchBreakdown, fetchRubric } from '@/lib/pitch-score/api';
import {
  DEFAULT_PERIOD,
  PERIOD_LABELS,
  periodHonoured,
  periodSubstituted,
  type Period,
} from '@/lib/pitch-score/period';
import type { RubricResponse } from '@/lib/pitch-score/rubric';
import {
  biggestOpportunity,
  elementsForSection,
  opportunityAcrossPeriod,
  reconciliation,
  sectionRows,
  sectionsSumToBase,
  violationRows,
} from '@/lib/pitch-score/breakdown-view';
import type { BreakdownResponse } from '@/lib/pitch-score/types';
import { PitchReadCaveats } from '@/components/pitch-read-caveats';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';
import { C } from '@/lib/theme';

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; data: BreakdownResponse; rubric: RubricResponse }
  | { phase: 'error'; message: string };

export function PitchBreakdownPage({
  period: controlled,
  onPeriodChange,
}: {
  /**
   * Controlled when the parent holds the selection, which it will once Progress sits beside this
   * board — the guide requires one selection across both. Uncontrolled until then, so this screen
   * is shippable on its own rather than waiting for a parent that does not exist yet.
   */
  period?: Period;
  onPeriodChange?: (next: Period) => void;
} = {}) {
  const [own, setOwn] = useState<Period>(DEFAULT_PERIOD);
  const period = controlled ?? own;
  const setPeriod = onPeriodChange ?? setOwn;

  const online = useOnline();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (p: Period, quiet = false) => {
      // The spinner belongs to the load, not to the effect that triggers it. Setting it in the
      // effect body is the cascading-render React warns about, and a pull-to-refresh must not
      // replace the board with a spinner it is already showing a spinner for.
      if (!quiet) setState({ phase: 'loading' });
      try {
        // Both in one go: the rubric supplies the section maxima these bars print, and a board that
        // rendered figures before it had them would show "9.8 /" with nothing after the slash.
        const [data, rubric] = await Promise.all([fetchBreakdown(p), fetchRubric()]);
        setState({ phase: 'ready', data, rubric });
      } catch (e) {
        setState({ phase: 'error', message: reachError(e, online, 'your rubric averages') });
      }
    },
    [online],
  );

  /*
    useFocusEffect, not useEffect — the convention every other loading screen in this app uses, and
    for two reasons beyond convention. Returning to the tab gets fresh figures rather than whatever
    was true when it first mounted; and setState inside a bare mount effect is the cascading render
    React warns about.
  */
  useFocusEffect(
    useCallback(() => {
      void load(period);
    }, [period, load]),
  );

  return (
    <ScrollView
      contentContainerClassName="px-5 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await load(period, true);
            } finally {
              setRefreshing(false);
            }
          }}
          tintColor={C['muted-foreground']}
        />
      }
    >
      <PitchPeriodToggle
        period={period}
        onChange={setPeriod}
        disabled={state.phase === 'loading'}
      />

      {state.phase === 'loading' ? (
        <View className="mt-16 items-center">
          <ActivityIndicator color={C.primary} accessibilityLabel="Loading your rubric averages" />
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <View
          // The read failed and replaced the board. A sighted rep sees the swap; without this a
          // screen-reader user is told nothing at all.
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-6"
        >
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Could not load your rubric averages
          </Text>
          <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
            {state.message}
          </Text>
        </View>
      ) : null}

      {state.phase === 'ready' ? <Board data={state.data} rubric={state.rubric} asked={period} /> : null}
    </ScrollView>
  );
}

function Board({
  data,
  rubric,
  asked,
}: {
  data: BreakdownResponse;
  rubric: RubricResponse;
  asked: Period;
}) {
  const agg = data.aggregate;
  const rows = sectionRows(agg.sectionAverages, rubric.sections);
  const opp = biggestOpportunity(agg.elementStats);
  const rec = reconciliation(agg);
  const sumsToBase = sectionsSumToBase(rows, agg.avgBase);
  const violations = violationRows(agg.violationStats, rubric.violations);
  // The sheet opens OVER this board rather than replacing it, so the figures a rep is reading
  // are still there when they close it. That is why page 4 is not a fourth destination.
  const [sheetOpen, setSheetOpen] = useState(false);

  if (agg.counted === 0) {
    return (
      <View className="mt-8 gap-3">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          Nothing counted {PERIOD_LABELS[asked].toLowerCase() === 'all time' ? 'yet' : 'in this period'}
        </Text>
        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          {agg.pitchesTotal > 0
            ? `You recorded ${agg.pitchesTotal} ${agg.pitchesTotal === 1 ? 'pitch' : 'pitches'}, and none of them counted. A pitch counts once it reaches Discovery and scores ${rubric.qualifyingMinBase} or more on the base.`
            : 'These averages come from your own recorded pitches. Record one at a door and it appears here once the coach has been through it.'}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* The server may answer a different window from the one asked for — it substitutes silently
          rather than failing. Said before any figure, because every number below belongs to
          whichever period actually came back. */}
      {periodHonoured(asked, data) ? null : (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-4 font-body text-sm leading-relaxed text-foreground"
        >
          {periodSubstituted(asked, data)}
        </Text>
      )}

      <View className="mt-5 flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Your rubric averages
          </Text>
          <Text className="mt-1 font-body text-sm text-muted-foreground">
            {agg.counted} qualifying {agg.counted === 1 ? 'pitch' : 'pitches'}
            {agg.notCounted > 0 ? ` · ${agg.notCounted} not counted` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="How points work — open the scoring rubric"
          className="min-h-7 justify-center rounded-md border border-border-control px-3 active:opacity-70"
        >
          <Text className="font-emphasis text-sm text-primary">Rubric</Text>
        </Pressable>
      </View>

      <PitchRubricSheet
        rubric={rubric}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />

      {/* What the read says about itself. `capped` was rendered here inline and
          `skippedPreVerdict` was not rendered at all — pitches the server deliberately excluded
          and counted so that a board could say so, on a board that never said so. */}
      <PitchReadCaveats data={data} />

      {opp ? (
        <View className="mt-5 rounded-xl border border-primary px-4 py-4">
          <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
            Biggest opportunity
          </Text>
          <Text className="mt-2 font-strong text-base text-foreground">
            {opp.label}: averaging {opp.avgPoints} of {opp.maxPoints}
          </Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            Hitting it every pitch adds {opp.gainPerPitch} points per pitch, about +
            {opportunityAcrossPeriod(opp.gainPerPitch, agg.counted)} across your {agg.counted}{' '}
            {agg.counted === 1 ? 'pitch' : 'pitches'}.
          </Text>
        </View>
      ) : null}

      <View className="mt-8 flex-row items-baseline justify-between gap-3">
        <Text
          accessibilityRole="header"
          className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
        >
          Base score
        </Text>
        <Text className="font-heading text-2xl tabular-nums text-foreground">
          {agg.avgBase}
          <Text className="font-body text-sm text-muted-foreground"> / {rubric.baseMax}</Text>
        </Text>
      </View>

      {/* The checklist's first identity, checked rather than assumed. Silent when it holds. */}
      {sumsToBase ? null : (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-body text-sm leading-relaxed text-foreground"
        >
          These six do not add up to the base score above them, so one of the two is wrong. The
          figures are shown as they came back rather than adjusted to agree.
        </Text>
      )}

      <View className="mt-3 gap-3">
        {rows.map((row) => (
          <View key={row.id} className="rounded-xl border border-border-control px-4 py-3">
            <View className="flex-row items-baseline justify-between gap-2">
              <View className="flex-1 flex-row items-center gap-2">
                <Text className="font-strong text-base text-foreground">{row.label}</Text>
                {row.lowest ? (
                  <Text className="font-emphasis text-xs uppercase tracking-wide text-primary">
                    Lowest
                  </Text>
                ) : null}
              </View>
              <Text className="font-emphasis text-base tabular-nums text-foreground">
                {row.points}
                <Text className="font-body text-sm text-muted-foreground"> / {row.max}</Text>
              </Text>
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-surface-raised"
            >
              <View
                className="h-full rounded-sm bg-primary"
                style={{ width: `${row.fraction * 100}%` }}
              />
            </View>

            {/* The lowest section opens INLINE, inside its own card — not on a new screen. */}
            {row.lowest ? <Elements rows={elementsForSection(agg.elementStats, row.id)} /> : null}
          </View>
        ))}
      </View>

      <View className="mt-8 flex-row items-baseline justify-between gap-3">
        <Text
          accessibilityRole="header"
          className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
        >
          Bonus points
        </Text>
        <Text className="font-heading text-2xl tabular-nums text-primary">
          +{agg.avgBonus}
          <Text className="font-body text-sm text-muted-foreground">
            {' '}
            / {rubric.bonusCap} cap
          </Text>
        </Text>
      </View>
      <View className="mt-3 gap-2">
        {agg.bonusStats.length === 0 ? (
          <Text className="font-body text-sm leading-relaxed text-muted-foreground">
            No bonuses earned in these pitches.
          </Text>
        ) : (
          agg.bonusStats.map((b) => (
            <View
              key={b.bonusId}
              accessible
              accessibilityLabel={`${b.label}, earned in ${Math.round(b.earnedInRate * 100)} percent of pitches, worth ${b.avgPoints} points on average`}
              className="flex-row items-baseline justify-between gap-3"
            >
              <Text className="flex-1 font-body text-sm text-foreground">{b.label}</Text>
              <Text className="font-body text-sm tabular-nums text-muted-foreground">
                {Math.round(b.earnedInRate * 100)}%
              </Text>
              <Text className="w-16 text-right font-emphasis text-sm tabular-nums text-primary">
                +{b.avgPoints}
              </Text>
            </View>
          ))
        )}
      </View>

      <View className="mt-8 flex-row items-baseline justify-between gap-3">
        <Text
          accessibilityRole="header"
          className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
        >
          Violations
        </Text>
        <Text className="font-heading text-2xl tabular-nums text-destructive">
          −{agg.avgViolations}
        </Text>
      </View>
      <View className="mt-3 gap-2">
        {violations.map((v) => (
          <View
            key={v.violationId}
            accessible
            accessibilityLabel={
              v.clean
                ? `${v.label}: none`
                : `${v.label}, in ${Math.round(v.rate * 100)} percent of pitches, costing ${v.avgDeduction} points on average`
            }
            className="flex-row items-baseline justify-between gap-3"
          >
            <Text className="flex-1 font-body text-sm text-foreground">{v.label}</Text>
            {/* A clean row is SHOWN, not dropped. "None · 0" is the rep being told they did not do
                the worst thing on the list, and it is the most valuable row on this card. */}
            <Text className="font-body text-sm tabular-nums text-muted-foreground">
              {v.clean ? 'None' : `${Math.round(v.rate * 100)}%`}
            </Text>
            <Text
              className={`w-16 text-right font-emphasis text-sm tabular-nums ${
                v.clean ? 'text-muted-foreground' : 'text-destructive'
              }`}
            >
              {v.clean ? '0' : `−${v.avgDeduction}`}
            </Text>
          </View>
        ))}
      </View>

      {/* THE FOOTER IS AN ASSERTION. It prints the identity only when the identity holds; when it
          does not, it says so instead of printing four numbers that look like arithmetic. */}
      <View className="mt-8 border-t border-border pt-4">
        {rec.holds ? (
          <Text
            accessible
            accessibilityLabel={`${rec.base} base plus ${rec.bonus} bonus minus ${rec.violations} equals ${rec.reported} average Pitch Score`}
            className="font-emphasis text-base tabular-nums text-foreground"
          >
            {rec.base} base + {rec.bonus} bonus − {rec.violations} ={' '}
            <Text className="font-heading text-xl text-primary">{rec.reported}</Text> avg
          </Text>
        ) : (
          <Text
            accessibilityRole="alert"
            className="font-body text-sm leading-relaxed text-foreground"
          >
            These parts do not add up to the average above: {rec.base} + {rec.bonus} − {rec.violations}{' '}
            comes to {rec.computed}, and your average Pitch Score reads {rec.reported}. Both are shown
            as they came back rather than one being adjusted to fit the other.
          </Text>
        )}
        {/* R-D: two scoring systems stand, each saying what it counts. The Arena is one segment
            away and its points are a different scale entirely. */}
        <Text className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
          Pitch Score, from the AT&amp;T Fiber rubric — out of {rubric.maxScore}. Your points total in
          Points is a different measure and does not compare.
        </Text>
      </View>
    </View>
  );
}

function Elements({ rows }: { rows: ReturnType<typeof elementsForSection> }) {
  if (rows.length === 0) return null;
  return (
    <View className="mt-4 gap-3 border-t border-border pt-3">
      {rows.map((e) => (
        <View
          key={e.elementId}
          accessible
          accessibilityLabel={`${e.label}, ${e.avgPoints} of ${e.maxPoints}. ${Math.round(e.hitRate * 100)} percent hit, ${Math.round(e.partialRate * 100)} percent partial, ${Math.round(e.missedRate * 100)} percent missed.`}
        >
          <View className="flex-row items-baseline justify-between gap-2">
            <Text className="flex-1 font-body text-sm text-foreground">{e.label}</Text>
            <Text className="font-emphasis text-sm tabular-nums text-foreground">
              {e.avgPoints}
              <Text className="font-body text-xs text-muted-foreground"> / {e.maxPoints}</Text>
            </Text>
          </View>
          <Text className="mt-0.5 font-body text-xs text-muted-foreground">
            {Math.round(e.hitRate * 100)}% hit · {Math.round(e.partialRate * 100)}% partial ·{' '}
            {Math.round(e.missedRate * 100)}% missed
          </Text>
        </View>
      ))}
    </View>
  );
}
