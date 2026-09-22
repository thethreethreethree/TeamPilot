/**
 * Progress — the rep's Pitch Score for the period (mockup p1).
 *
 * TWO THINGS THE DRAWING SHOWS THAT THIS BOARD DOES NOT, both because the data does not exist
 * rather than because they were skipped. Recorded here so the difference reads as a decision:
 *
 *   1. "WEEK 38 SHOWDOWN · Ends Sun 11:59 PM". There is no competition entity in the product — no
 *      name, no end time, nothing to read them from [OBSERVED 2026-09-22, swept across the
 *      pitch-score lib and its seven routes]. Printing a week number and a deadline would be
 *      inventing a deadline a rep would plan around.
 *   2. "YOUR BEST PITCHES" as three tappable cards with dates. The aggregate carries
 *      `bestPitchScore` — one number, from `reduce(Math.max)` — and no list, no dates and no session
 *      ids. The single figure IS shown, on the gauge, because that one exists.
 *
 * WHAT §4 FORBIDS IS ABSENT, AND THAT IS NOT A BUG AGAINST THE MOCKUP. The founder ruled on
 * 2026-09-22 that when the rubric sheet and `SalesCoach-KPI-System.md` disagree about what a REP
 * sees, the KPI document wins, and the test is whether a figure is a target or a position. So "62
 * pts behind #1" survives — a distance you close by pitching better — while "#2 on your team",
 * "118 pts ahead of #3" and "rank #2" do not.
 *
 * It is enforced by ABSENCE, not by a flag. The route strips `rank`, `boardSize` and `gaps.ahead`
 * before they leave the server, and this board branches on whether a field arrived. A component
 * asking "am I a manager?" can be wrong; a value that never arrives cannot be leaked.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ArenaGauge } from '@/components/arena-gauge';
import { PitchPeriodToggle } from '@/components/pitch-period-toggle';
import { PitchRubricSheet } from '@/components/pitch-rubric-sheet';
import { fetchBreakdown, fetchLeaderboard, fetchRubric } from '@/lib/pitch-score/api';
import {
  DEFAULT_PERIOD,
  PERIOD_LABELS,
  periodHonoured,
  periodSubstituted,
  type Period,
} from '@/lib/pitch-score/period';
import type { RubricResponse } from '@/lib/pitch-score/rubric';
import type { BreakdownResponse, LeaderboardResponse } from '@/lib/pitch-score/types';
import { bandFor, bandLabel } from '@/lib/gamification/points';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';
import { C } from '@/lib/theme';

type Loaded = {
  data: BreakdownResponse;
  rubric: RubricResponse;
  /** Null when the competition read failed — the card is omitted, never drawn at zero. */
  board: LeaderboardResponse | null;
  /** Today's points, when the selected period is wider than a day. Null when unknown. */
  today: number | null;
};

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; loaded: Loaded }
  | { phase: 'error'; message: string };

export function PitchProgressPage({
  period: controlled,
  onPeriodChange,
}: {
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
      if (!quiet) setState({ phase: 'loading' });
      try {
        // The two the board cannot render without. If either fails the board fails, because a gauge
        // with no scale and a bar with no maximum are not degraded versions of themselves.
        const [data, rubric] = await Promise.all([fetchBreakdown(p), fetchRubric()]);

        /*
          The competition card and today's gain are SEPARATELY optional, and each failure costs only
          its own card. A failed leaderboard read once told a rep on the Arena that they had closed
          no deals — the same shape as a failed read drawn as a zero, on the screen entirely about
          their own performance. Null here means the card is omitted, not that it shows nothing.
        */
        const board = await fetchLeaderboard(p).catch(() => null);
        const today =
          p === 'day'
            ? null
            : await fetchBreakdown('day')
                .then((d) => d.aggregate.totalPoints)
                .catch(() => null);

        setState({ phase: 'ready', loaded: { data, rubric, board, today } });
      } catch (e) {
        setState({ phase: 'error', message: reachError(e, online, 'your Pitch Score') });
      }
    },
    [online],
  );

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
      <PitchPeriodToggle period={period} onChange={setPeriod} disabled={state.phase === 'loading'} />

      {state.phase === 'loading' ? (
        <View className="mt-16 items-center">
          <ActivityIndicator color={C.primary} accessibilityLabel="Loading your Pitch Score" />
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" className="mt-6">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Could not load your Pitch Score
          </Text>
          <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
            {state.message}
          </Text>
        </View>
      ) : null}

      {state.phase === 'ready' ? <Board loaded={state.loaded} asked={period} /> : null}
    </ScrollView>
  );
}

function Board({ loaded, asked }: { loaded: Loaded; asked: Period }) {
  const { data, rubric, board, today } = loaded;
  const agg = data.aggregate;
  const [sheetOpen, setSheetOpen] = useState(false);

  if (agg.counted === 0) {
    return (
      <View className="mt-8 gap-3">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          No counted pitches yet
        </Text>
        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          {agg.pitchesTotal > 0
            ? `You recorded ${agg.pitchesTotal} ${agg.pitchesTotal === 1 ? 'pitch' : 'pitches'} in this period and none counted. A pitch counts once it reaches Discovery and scores ${rubric.qualifyingMinBase} or more on the base.`
            : 'Your Pitch Score comes from pitches you record at a door. Record one and it appears here once the coach has been through it.'}
        </Text>
      </View>
    );
  }

  const band = bandLabel(bandFor(agg.avgPitchScore));

  return (
    <View>
      {periodHonoured(asked, data) ? null : (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-4 font-body text-sm leading-relaxed text-foreground"
        >
          {periodSubstituted(asked, data)}
        </Text>
      )}

      {/*
        THE COMPETITION CARD READS ITS OWN WINDOW AND SAYS SO (founder ruling R-C).

        The toggle governs the gauge, the chips and the Breakdown board. It does NOT govern this
        card, and the reason is a real mismatch rather than a preference: the leaderboard route
        accepts only week, month and all — a `day` selection falls back to ALL TIME, silently. A card
        that followed the toggle would have put an all-time standing above a one-day gauge with
        nothing saying so. Naming its own window makes that impossible to express.
      */}
      {board?.standing ? (
        <View className="mt-5 rounded-xl border border-border-control px-4 py-4">
          <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
            Competition · {PERIOD_LABELS[board.period].toLowerCase()}
          </Text>
          {board.gaps.behind != null ? (
            <Text className="mt-2 font-strong text-base text-foreground">
              {board.gaps.behind} {board.gaps.behind === 1 ? 'point' : 'points'} behind the rep above
              you
            </Text>
          ) : (
            <Text className="mt-2 font-strong text-base text-foreground">
              Nobody is ahead of you in this window.
            </Text>
          )}
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {board.standing.prizeEligible
              ? `Prize eligible — ${rubric.prizeEligibleMinPitches}-pitch minimum met.`
              : `${board.standing.counted} of ${rubric.prizeEligibleMinPitches} counted pitches towards prize eligibility.`}
          </Text>
        </View>
      ) : null}

      <View className="mt-6 items-center">
        <ArenaGauge
          average={agg.avgPitchScore}
          // Consumed, not re-derived. `bandFor` already clamps above 100, which is why a 106.5 pitch
          // bands as Elite rather than falling outside the scale — the web reached that the hard
          // way, after a four-band copy put 95 at Elite in one card and Strong in the one beneath.
          bandText={band ?? ''}
          sub={agg.bestPitchScore != null ? `Best ${agg.bestPitchScore}` : ''}
          // 0-130, not 0-100. The old hard-coded clamp would have drawn 106.5 as a full gauge.
          max={rubric.maxScore}
        />
        <Text className="mt-1 font-body text-xs uppercase tracking-widest text-muted-foreground">
          Avg Pitch Score
        </Text>
      </View>

      <View className="mt-5 flex-row gap-2">
        <Chip value={`${agg.avgBase}`} label={`Avg base / ${rubric.baseMax}`} />
        <Chip value={`+${agg.avgBonus}`} label={`Avg bonus / ${rubric.bonusCap}`} tone="good" />
        <Chip value={`−${agg.avgViolations}`} label="Avg violations" tone="bad" />
      </View>

      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="How points work — open the scoring rubric"
        className="mt-4 min-h-7 items-center justify-center rounded-md border border-border-control px-4 active:opacity-70"
      >
        <Text className="font-emphasis text-sm text-primary">View scoring rubric</Text>
      </Pressable>

      <PitchRubricSheet rubric={rubric} visible={sheetOpen} onClose={() => setSheetOpen(false)} />

      <View className="mt-8 items-center">
        <Text
          accessible
          accessibilityLabel={`${agg.totalPoints} total Pitch Score points ${periodPhrase(asked)}`}
          className="font-heading text-4xl tabular-nums text-primary"
        >
          {agg.totalPoints}
        </Text>
        <Text className="mt-1 font-body text-xs uppercase tracking-widest text-muted-foreground">
          Total points earned
        </Text>
        {/* Omitted rather than shown as +0 when the day read failed: "you earned nothing today" and
            "we could not find out" are different sentences, and only one of them is honest. */}
        <Text className="mt-1 font-body text-sm text-muted-foreground">
          {today != null ? `+${today} today · ` : ''}
          {periodPhrase(asked)}
        </Text>
      </View>

      <View className="mt-8 rounded-xl border border-border-control px-4 py-4">
        <Text className="font-strong text-base text-foreground">
          {agg.counted} of {agg.pitchesTotal} {agg.pitchesTotal === 1 ? 'pitch' : 'pitches'} counted
        </Text>
        {agg.notCounted > 0 ? (
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {reasonSentence(agg.notCountedReasons, agg.notCounted, rubric.qualifyingMinBase)}
          </Text>
        ) : null}
      </View>

      {/* R-D: two scoring systems stand, each saying what it counts. The Arena is a segment away and
          its points are a different measure on a different scale. */}
      <Text className="mt-8 font-body text-xs leading-relaxed text-muted-foreground">
        Pitch Score, from the AT&amp;T Fiber rubric — out of {rubric.maxScore}, rubric{' '}
        {rubric.version}. Your points total in Points counts scored sessions instead, and the two do
        not compare.
      </Text>
    </View>
  );
}

function periodPhrase(p: Period): string {
  return p === 'all' ? 'all time' : `this ${p}`;
}

/**
 * Why the excluded pitches were excluded, in the rep's words.
 *
 * Qualification is judged on BASE and the list shows TOTAL, so two rows can carry near-identical
 * numbers with opposite counted status — the mockup has a 44.0 labelled "Not counted". Nothing on
 * screen explains that unless the reasons are printed, which is why the server stores them.
 *
 * Falls back to the count alone when the server sent a reason this app has never seen. An unknown
 * reason is still a real exclusion; dropping the sentence would turn it into a silent one.
 */
function reasonSentence(
  reasons: Record<string, number>,
  notCounted: number,
  minBase: number,
): string {
  const known = Object.values(reasons).reduce((n, v) => n + v, 0);
  if (known === 0) {
    return `${notCounted} did not count. The reason was not recorded.`;
  }
  return `${notCounted} did not reach Discovery or scored under ${minBase} on the base.`;
}

function Chip({
  value,
  label,
  tone = 'plain',
}: {
  value: string;
  label: string;
  tone?: 'plain' | 'good' | 'bad';
}) {
  const colour =
    tone === 'good' ? 'text-primary' : tone === 'bad' ? 'text-destructive' : 'text-foreground';
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 rounded-lg border border-border-control px-3 py-3"
    >
      <Text className={`font-heading text-lg tabular-nums ${colour}`}>{value}</Text>
      <Text numberOfLines={2} className="mt-0.5 font-body text-xs leading-tight text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}
