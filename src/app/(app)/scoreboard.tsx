/**
 * Scoreboard — where the team stands.
 *
 * Mirrors the web's Scoreboard: rank, name, points, sessions and deals, with the
 * signed-in rep's own row marked. Reads `gamification_leaderboard` directly, so
 * it is live without the backend branch.
 *
 * AGGREGATES ONLY. The function returns no per-session detail, and this screen
 * asks for none: a rep's individual scores are private to them, and a
 * leaderboard that leaked them would turn a coaching tool into a surveillance
 * one. Their own figures live on Your points, which nobody else can open.
 *
 * NO XP BARS, LEVELS, STREAKS OR CONFETTI, matching the web's own restraint. The
 * board is a fact about the team, not a game layer bolted onto one — and a rep
 * near the bottom is a person who needs coaching, not somebody to be animated at.
 */
import { memo, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import { count } from '@/lib/format';
import { bandLabel } from '@/lib/gamification/points';
import {
  myRank,
  rank,
  PERIOD_LABEL,
  type LeaderboardRow,
  type RankedRow,
  type Period,
} from '@/lib/gamification/leaderboard';
import { fetchLeaderboard } from '@/lib/gamification/leaderboard-api';
import { C } from '@/lib/theme';
import { useLargeText } from '@/lib/use-large-text';

/**
 * Do not refetch on every focus.
 *
 * The same floor the sessions list uses, for the same reason and more of it: a
 * load here pages the whole ledger and pulls the company board, so a rep
 * glancing away and back would spend that twice. Fifteen seconds is long enough
 * to stop the churn and short enough that a call scored while they were on
 * another screen still appears when they come back.
 */
const REFETCH_AFTER_MS = 15_000;

type Phase = 'loading' | 'ready' | 'error';
const PERIODS: Period[] = ['week', 'month', 'all'];

export default function ScoreboardScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  /**
   * ALL TIME, matching the web.
   *
   * `Scoreboard.tsx` opens on `"all"`. Opening on `week` here meant a rep
   * checking the same board on their phone and on the website saw different
   * totals AND a different order — and would reasonably conclude one of them was
   * wrong, rather than that they were being shown two different questions.
   *
   * It is also the kinder default: early in a week the board is empty or nearly
   * so, and "nobody has scored" is a discouraging thing to open onto when the
   * rep has a full history sitting one tap away.
   */
  const [period, setPeriod] = useState<Period>('all');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { rows: fresh, failed } = await fetchLeaderboard(period);
    setRows(fresh);
    setPhase(failed ? 'error' : 'ready');
  }, [period]);

  const lastLoad = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastLoad.current < REFETCH_AFTER_MS) return;
      lastLoad.current = Date.now();
      void load();
    }, [load]),
  );

  const ranked = rank(rows, userId);
  const mine = myRank(ranked);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-4 pb-10 pt-4"
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              // An explicit pull is never throttled: the rep asked.
              lastLoad.current = Date.now();
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={C['muted-foreground']}
          />
        }
      >
        <View className="flex-row gap-2">
          {PERIODS.map((p) => {
            const on = p === period;
            return (
              <Pressable
                key={p}
                onPress={() => {
                  // A period change is a different question, not a refresh —
                  // the floor must not swallow it.
                  lastLoad.current = 0;
                  setPeriod(p);
                  setPhase('loading');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Show ${PERIOD_LABEL[p].toLowerCase()}`}
                className={`min-h-7 flex-1 items-center justify-center rounded-md border px-2 py-2 active:opacity-70 ${
                  on ? 'border-primary bg-surface' : 'border-border-control'
                }`}
              >
                <Text
                  className={`font-emphasis text-sm ${on ? 'text-primary' : 'text-foreground'}`}
                >
                  {PERIOD_LABEL[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {phase === 'loading' ? (
          <View className="items-start gap-3 py-6">
            <ActivityIndicator color={C['muted-foreground']} />
            <Text className="font-body text-base text-muted-foreground">
              Reading the scoreboard…
            </Text>
          </View>
        ) : phase === 'error' ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-4 gap-3 rounded-md border border-destructive px-3 py-3"
          >
            <Text className="font-body text-base leading-relaxed text-destructive">
              The scoreboard could not be read. That is not the same as nobody having scored.
            </Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel="Try reading the scoreboard again"
              className="min-h-7 justify-center self-start rounded-md border border-primary px-4 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">Try again</Text>
            </Pressable>
          </View>
        ) : ranked.length === 0 ? (
          <View className="mt-6 gap-3">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Nothing scored {PERIOD_LABEL[period].toLowerCase()}
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              {/* Names the period, because "no scores" without it reads as the
                  team never having scored at all. */}
              Nobody on your team has banked points in this period. Try All time, or record a
              call and it appears here once the coach has scored it.
            </Text>
          </View>
        ) : (
          <View className="mt-5 gap-2">
            {/* Their own standing, said once at the top so a rep does not have to
                hunt the list for themselves. */}
            {/* The web carries the same strip on its own Scoreboard (7ff6fdc2):
                an at-a-glance personal summary on the team board, linking to the
                full Arena rather than duplicating it here. */}
            <Pressable
              onPress={() => router.push('/(app)/progress')}
              accessibilityRole="button"
              accessibilityLabel={
                mine
                  ? `You are ${ordinal(mine.rank)} of ${ranked.length} with ${count(mine.totalPoints)} points. Opens your points.`
                  : 'You are not on this board yet. Opens your points.'
              }
              className="mb-1 min-h-7 flex-row items-baseline justify-between gap-3 active:opacity-70"
            >
              <Text className="flex-1 font-body text-sm leading-relaxed text-muted-foreground">
                {mine
                  ? `You are ${ordinal(mine.rank)} of ${ranked.length} with ${count(mine.totalPoints)} points.`
                  : 'You are not on this board yet — it starts once a call of yours has been scored.'}
              </Text>
              <Text className="font-emphasis text-sm text-primary">Your points</Text>
            </Pressable>

            <View className="gap-2">
              {ranked.map((r) => (
                <Row key={r.agentId} r={r} />
              ))}
            </View>

            <Text className="mt-3 font-body text-xs leading-relaxed text-muted-foreground">
              Totals only. Nobody here can see how any individual call was scored, including
              your manager — those stay with the rep who made it.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 1st, 2nd, 3rd — spoken as well as shown, so the rank reads as a placing. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * One rep's standing.
 *
 * Memoised because a board is a list and a period change re-renders the screen;
 * without this every row rebuilds when only the selection changed.
 */
const Row = memo(function Row({ r }: { r: RankedRow }) {
  // At large text the rank, name, band and points cannot share a line — the
  // name column is crushed to a character or two. Same treatment the account
  // rows already use.
  const stacked = useLargeText();
  return (
            <View
              key={r.agentId}
              accessible
              accessibilityLabel={`${ordinal(r.rank)}${r.isYou ? ', you' : ''}: ${
                r.displayName
              }, ${count(r.totalPoints)} points, ${r.sessions} scored ${
                r.sessions === 1 ? 'call' : 'calls'
              }, ${r.deals} sold${
                r.sessions > 0 ? `, average ${r.avgPoints}, best ${r.bestPoints}` : ''
              }${r.band ? `, ${bandLabel(r.band)}` : ''}`}
              className={`gap-3 rounded-lg border px-3 py-3 ${
                stacked ? '' : 'flex-row items-center'
              } ${r.isYou ? 'border-primary bg-surface' : 'border-border-control'}`}
            >
              {/*
                Spec 5.1: the top three are emphasised. Beyond that a rank is a
                fact, not a podium.

                EMPHASISED BY SIZE AND ONE AMBER — DELIBERATELY NOT GOLD, SILVER
                AND BRONZE, and this is a decision rather than an oversight.

                The web's Scoreboard uses `["text-amber-500", "text-slate-400",
                "text-orange-600"]` for the first three places. Copying that here
                would put a second and a third hue into a product whose design
                contract bans them outright — the same rule under which error is
                burnt amber rather than red, and which gate G3 enforces.

                Put to the founder on 4 September as a real conflict between two
                of their own rules (app and web identical / strictly mono-amber).
                They chose: the app stays mono-amber, the web keeps its podium.
                The medal idea still lives where it reads best — the manager's
                weekly digest email sends 🥇🥈🥉.

                So if you are here because the two scoreboards look different:
                they are meant to. Do not "fix" it.
              */}
              <Text
                className={`w-8 tabular-nums ${
                  r.rank <= 3 ? 'font-heading text-xl' : 'font-heading text-base'
                } ${r.isYou || r.rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {r.rank}
              </Text>
              <View className="flex-1">
                <View className="flex-row items-baseline gap-2">
                  <Text numberOfLines={1} className="flex-1 font-strong text-base text-foreground">
                    {r.displayName}
                    {r.isYou ? ' (you)' : ''}
                  </Text>
                  {/* A band chip, and nothing at all when there is no band —
                      an unscored rep has not been judged. */}
                  {r.band ? (
                    <Text className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
                      {bandLabel(r.band)}
                    </Text>
                  ) : null}
                </View>
                <Text className="mt-0.5 font-body text-sm text-muted-foreground">
                  {r.sessions} scored {r.sessions === 1 ? 'call' : 'calls'} · {r.deals} sold
                </Text>
                <Text className="mt-0.5 font-body text-sm tabular-nums text-muted-foreground">
                  {/* Avg and best, per the spec. Em dashes rather than zeros:
                      a rep with no scored call has no average to show. */}
                  avg {r.sessions > 0 ? r.avgPoints : '—'} · best{' '}
                  {r.sessions > 0 ? r.bestPoints : '—'}
                </Text>
              </View>
              <Text
                className={`font-heading text-lg tabular-nums ${
                  r.isYou ? 'text-primary' : 'text-foreground'
                }`}
              >
                {count(r.totalPoints)}
              </Text>
            </View>
  );
});
