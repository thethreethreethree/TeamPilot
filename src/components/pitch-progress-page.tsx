/**
 * Progress — the rep's Pitch Score for the period (mockup p1).
 *
 * ONE THING THE DRAWING SHOWS THAT THIS BOARD DOES NOT, because the data does not exist rather than
 * because it was skipped. Recorded here so the difference reads as a decision:
 *
 *   "WEEK 38 SHOWDOWN · Ends Sun 11:59 PM". There is no competition entity in the product — no name,
 *   no end time, nothing to read them from [OBSERVED 2026-09-22, swept across the pitch-score lib
 *   and its seven routes]. Printing a week number and a deadline would be inventing a deadline a rep
 *   would plan around.
 *
 * "YOUR BEST PITCHES" WAS THE SECOND SUCH ABSENCE AND IS NO LONGER ONE. The aggregate carries
 * `bestPitchScore` — one number, from `reduce(Math.max)` — and no list, no dates and no ids, so this
 * board first shipped with the single figure on the gauge and nothing else. `/pitch-score/best` was
 * then built to serve the list (deployed 2026-09-22) and the rows below read it. The rule the
 * absence was protecting still holds: what is rendered is what the server sent.
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
import { PitchMilestonesStrip } from '@/components/pitch-milestones-strip';
import { PitchReadCaveats } from '@/components/pitch-read-caveats';
import { PitchPeriodToggle } from '@/components/pitch-period-toggle';
import { PitchRubricSheet } from '@/components/pitch-rubric-sheet';
import { useOpenWebsite } from '@/components/website-link';
import {
  fetchBestPitches,
  fetchBreakdown,
  fetchLeaderboard,
  fetchMilestones,
  fetchRubric,
} from '@/lib/pitch-score/api';
import {
  DEFAULT_PERIOD,
  PERIOD_LABELS,
  periodHonoured,
  periodSubstituted,
  type Period,
} from '@/lib/pitch-score/period';
import type { RubricResponse } from '@/lib/pitch-score/rubric';
import type {
  BestPitchesResponse,
  BreakdownResponse,
  LeaderboardResponse,
  MilestonesResponse,
} from '@/lib/pitch-score/types';
import { bandFor, bandLabel } from '@/lib/gamification/points';
import { OUTCOME_LABEL, shortDate } from '@/lib/format';
import { webPitchScoreUrl } from '@/lib/web-links';
import { ENV } from '@/lib/env';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';
import { C, TABULAR } from '@/lib/theme';

type Loaded = {
  data: BreakdownResponse;
  rubric: RubricResponse;
  /** Null when the competition read failed — the card is omitted, never drawn at zero. */
  board: LeaderboardResponse | null;
  /** Today's points, when the selected period is wider than a day. Null when unknown. */
  today: number | null;
  /** Null when the best-pitches read failed — the list SAYS so, rather than reading as none. */
  best: BestPitchesResponse | null;
  /**
   * Null when the milestones read failed. Six grey badges is the sentence "you have done none
   * of this", which is a real statement about a rep and one a failed read has no standing to
   * make. The route refuses to make it too — it 500s rather than returning an empty strip.
   */
  milestones: MilestonesResponse | null;
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
        const best = await fetchBestPitches(p).catch(() => null);
        // No period: every milestone is a first or an Nth, so the toggle does not reach it and
        // the strip says so rather than sitting silently under a Day gauge.
        const milestones = await fetchMilestones().catch(() => null);
        const today =
          p === 'day'
            ? null
            : await fetchBreakdown('day')
                .then((d) => d.aggregate.totalPoints)
                .catch(() => null);

        setState({ phase: 'ready', loaded: { data, rubric, board, today, best, milestones } });
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
          // `tintColor` is iOS-only. Android reads `colors` and `progressBackgroundColor`, so
          // without these the pull-to-refresh spinner ignored the palette on half the devices.
          tintColor={C['muted-foreground']}
          colors={[C.primary]}
          progressBackgroundColor={C.surface}
        />
      }
    >
      <PitchPeriodToggle period={period} onChange={setPeriod} disabled={state.phase === 'loading'} />

      {state.phase === 'loading' ? (
        // `busy` as well as the label: the spinner is named, but without this a screen reader
        // is told nothing about the board being mid-read. Deliberately NOT a live region - one
        // wrapped round a whole board re-reads every figure on it at each change.
        <View accessibilityState={{ busy: true }} className="mt-16 items-center">
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
  const { data, rubric, board, today, best, milestones } = loaded;
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

      {/* Both usually false, both rendered. A gauge averaged over a truncated period reports a
          different number from the one its caption names, and nothing on screen looks wrong. */}
      <PitchReadCaveats data={data} />

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
      ) : board == null ? (
        /*
          THE OMISSION USED TO BE SILENT, which is this product's own named disease: a path that
          produces nothing while nothing says so. The card is still omitted — a failed leaderboard
          read once told a rep on the Arena that they had closed no deals, and drawing a zero here
          is the failure this whole board is organised against — but the absence now has a reason
          attached to it, so a rep who noticed the card yesterday is not left inventing one.
        */
        <Text className="mt-5 font-body text-sm leading-relaxed text-muted-foreground">
          Could not load where you stand in the competition. Pull down to try again.
        </Text>
      ) : (
        // `board` arrived and carries no standing: the read worked and the rep is not yet on the
        // board for its window. A real state, and a different sentence from the one above.
        <Text className="mt-5 font-body text-sm leading-relaxed text-muted-foreground">
          No competition standing in the {PERIOD_LABELS[board.period].toLowerCase()} window yet.
        </Text>
      )}

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
          className="font-heading text-4xl text-primary" style={TABULAR}>
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

      <BestPitches best={best} />

      <PitchMilestonesStrip data={milestones} />

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

/**
 * The rep's highest counted pitches, from `/pitch-score/best`.
 *
 * A COLUMN, NOT THE DRAWING'S THREE-ACROSS ROW. Three cards side by side leave roughly 110pt each,
 * which holds "106.5" and "Fri 12 Sep" at the default text size and clips both at the larger
 * Dynamic Type settings this app is required to honour. A full-width row cannot clip, and the
 * information is identical.
 *
 * IT NAMES ITS OWN WINDOW, for the reason the competition card above does: the header reads the
 * period the SERVER echoed, not the one the toggle asked for. The route honours all four of this
 * app's periods today, so the two always agree — which is exactly when a silent substitution gets
 * written in, and exactly when it is cheapest to make impossible.
 *
 * A FAILED READ SAYS SO. "You have no best pitches" is a real and discouraging sentence about a rep
 * who has some, and this app has drawn a failed read as a zero five times. Null is not empty here.
 *
 * A ROW WITHOUT A SESSION IS STILL A ROW. `pitch_scores.session_id` is `on delete set null`, so a
 * pitch outlives its recording; the SCORE is real and stays on screen. What goes is the tap — and
 * the row says why, because a card that is silently not tappable reads as a broken card.
 */
function BestPitches({ best }: { best: BestPitchesResponse | null }) {
  const { open, failed } = useOpenWebsite();

  if (best != null && best.pitches.length === 0) return null;

  return (
    <View className="mt-8">
      <Text
        accessibilityRole="header"
        className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
      >
        Your best pitches{best ? ` · ${PERIOD_LABELS[best.period].toLowerCase()}` : ''}
      </Text>

      {best == null ? (
        <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          Could not load your best pitches. Pull down to try again.
        </Text>
      ) : null}

      {best?.pitches.map((p) => {
        const url = webPitchScoreUrl(ENV.API_BASE, p.sessionId);
        const outcome =
          p.outcome && p.outcome in OUTCOME_LABEL
            ? OUTCOME_LABEL[p.outcome as keyof typeof OUTCOME_LABEL]
            : null;
        const line = `${shortDate(p.recordedAt)}${outcome ? ` · ${outcome}` : ''}`;
        const spoken = `${p.total} points, ${line.replace(/ · /g, ', ')}`;

        return (
          <Pressable
            key={p.pitchId}
            disabled={url == null}
            onPress={url ? () => open(url) : undefined}
            /*
              STILL A LINK, JUST AN UNAVAILABLE ONE. Dropping the role left the row announced as
              plain text, which loses the only clue that its siblings open something. The role
              stays and `accessibilityState.disabled` carries the difference — a screen reader
              says "link, dimmed", which is exactly what it is.
            */
            accessibilityRole="link"
            accessible
            accessibilityLabel={
              url
                ? `${spoken}. Opens this pitch on the website.`
                : `${spoken}. The recording was deleted, so there is nothing to open.`
            }
            accessibilityState={{ disabled: url == null }}
            // Reduced opacity AND the state flag, per the component rules: a row styled exactly
            // like the tappable ones above it teaches a rep it is dead only by being tapped.
            className={`mt-2 min-h-7 flex-row items-center justify-between rounded-xl border border-border-control px-4 py-3 ${
              url == null ? 'opacity-60' : 'active:opacity-70'
            }`}
          >
            <View className="flex-1 pr-3">
              <Text className="font-body text-sm text-muted-foreground">{line}</Text>
              {url == null ? (
                <Text className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                  Recording deleted — the score stands, the detail is gone.
                </Text>
              ) : null}
            </View>
            <Text className="font-heading text-xl text-primary" style={TABULAR}>{p.total}</Text>
          </Pressable>
        );
      })}

      {failed ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-body text-sm leading-relaxed text-foreground"
        >
          Could not open a browser. The pitch is on the website under Sales Coach.
        </Text>
      ) : null}
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
      <Text className={`font-heading text-lg ${colour}`} style={TABULAR}>{value}</Text>
      <Text numberOfLines={2} className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}
