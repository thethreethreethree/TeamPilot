/**
 * How your numbers are moving.
 *
 * WHY IT IS A SEPARATE SCREEN. The KPI board answers "where am I?" and is
 * already long. This answers "am I getting better?", which is a different
 * question a rep asks at a different moment — usually after a bad week, when a
 * single number is least able to settle it. Folding it into the board would make
 * both harder to read and cost every rep a second request they did not ask for.
 *
 * EVERY FIGURE IS THE SERVER'S. The months are frozen snapshots, not today's
 * number repeated backwards, and each month-over-month delta was computed there.
 * This screen labels and draws; a second copy of the maths
 * here would be the drift the architecture forbids.
 *
 * THE BARS ARE NOT THE POINT. They give the shape at a glance, but every value
 * is also written out and every gap is named — a trend a rep can only see is a
 * trend a rep cannot check, and one they cannot read at all if they are using a
 * screen reader.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { coachGet } from '@/lib/coach-api';
import { buildTrendView, type TrendRow, type TrendView } from '@/lib/trajectory-view';
import type { TrajectoryResponse } from '@/types/backend';
import { useOnline, isOffline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { useAuth } from '@/lib/auth-context';
import { readCachedTrend, writeCachedTrend } from '@/lib/sync/trend-cache';
import { clockTime, shortDate } from '@/lib/format';
import { C } from '@/lib/theme';
import { useLargeText } from '@/lib/use-large-text';
import { authFailureMessage } from '@/lib/auth-failure';
import { blockedState } from '@/lib/blocked-state';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', 'your trend');

type State =
  | { phase: 'loading' }
  /** `cachedAt` is set only when these months came off the device. Said on
   *  screen, because the newest month is the one that can have changed and the
   *  one a rep is most likely looking for. */
  | { phase: 'ready'; view: TrendView; cachedAt: Date | null }
  | { phase: 'needs-shim' }
  | { phase: 'error'; message: string };

export default function TrendScreen() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();
  const offline = isOffline(online);

  const load = useCallback(async () => {
    try {
      const res = await coachGet<TrajectoryResponse>('/api/coach/kpi/trajectory');
      setState({ phase: 'ready', view: buildTrendView(res), cachedAt: null });
      if (userId) writeCachedTrend(userId, res);
    } catch (e) {
      // Months the rep has already seen beat an error screen — and unlike live
      // figures, a frozen month cannot have gone wrong in the meantime.
      const cached = userId ? await readCachedTrend(userId) : null;
      if (cached) {
        setState({ phase: 'ready', view: buildTrendView(cached.res), cachedAt: cached.at });
        return;
      }
      const status = (e as { status?: number })?.status;
      // NOT A LOGIN PROBLEM WHEN `authFailure` says otherwise — and the reason
      // this branch exists has CHANGED, so the old wording is not kept.
      //
      // It used to read "the route cannot read a mobile token yet". Every coach
      // route this app calls now resolves a mobile Bearer token — swept and
      // confirmed against the web repository on 4 September, after three screens
      // were found telling reps to wait for a deploy that had already happened.
      //
      // So a 401/403 that is NOT `signed-out` no longer implies a missing shim.
      // It means the server refused a live token, for a reason this app cannot
      // see: an account with no company, a deactivated user, a row that is not
      // there. `blockedState('route', …)` says exactly that and guesses no
      // further.
      const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
      if (why === 'signed-out') {
        setState({ phase: 'error', message: authFailureMessage('signed-out') });
        return;
      }
      if (status === 401 || status === 403) {
        setState({ phase: 'needs-shim' });
        return;
      }
      setState({
        phase: 'error',
        message: reachError(e, online, 'your trend'),
      });
    }
  }, [userId, online]);

  // useFocusEffect, not useEffect: this is what every other loading screen in
  // the app uses, and setState inside a bare mount effect triggers the
  // cascading render React warns about. Returning to the screen also gets
  // fresh figures rather than whatever was true when it first mounted.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
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
        {offline ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-4 rounded-md border border-border-control px-3 py-3"
          >
            <Text className="font-strong text-base text-foreground">No connection</Text>
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              Your months are worked out on the server, so they need signal. Pull down
              once you have a bar.
            </Text>
          </View>
        ) : null}

        {state.phase === 'loading' ? (
          <View className="mt-16 items-center">
            <ActivityIndicator color={C.primary} accessibilityLabel="Loading your trend" />
          </View>
        ) : null}

        {state.phase === 'needs-shim' ? (
          <View className="mt-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              {BLOCKED.title}
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {BLOCKED.body}
            </Text>
          </View>
        ) : null}

        {state.phase === 'error' ? (
          <View className="mt-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Could not load your trend
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {state.message}
            </Text>
            <Pressable
              onPress={load}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              className="mt-4 min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
            >
              <Text className="font-strong text-base text-primary-foreground">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {state.phase === 'ready' ? (
          <Trend view={state.view} cachedAt={state.cachedAt} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Trend({ view, cachedAt }: { view: TrendView; cachedAt: Date | null }) {
  const saved = cachedAt ? (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="mt-4 rounded-md border border-border-control px-3 py-3"
    >
      <Text className="font-strong text-base text-foreground">Saved months</Text>
      <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
        As of {shortDate(cachedAt.toISOString())} at {clockTime(cachedAt.toISOString())}. Finished
        months do not change, so these are still right — but a month that has closed since is not
        here yet.
      </Text>
    </View>
  ) : null;

  if (view.building) {
    return (
      <View className="mt-6">
        {saved}
        <Text accessibilityRole="header" className="mt-4 font-heading text-xl text-foreground">
          Not enough months yet
        </Text>
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          {view.monthsCovered === 0
            ? 'A trend needs a few months of calls behind it. Yours will appear here as they build up.'
            : `${view.monthsCovered} ${view.monthsCovered === 1 ? 'month' : 'months'} so far. A trend needs a few more before it means anything.`}
        </Text>
      </View>
    );
  }

  return (
    <View>
      {saved}
      <Text className="mt-4 font-body text-sm text-muted-foreground">
        Across {view.monthsCovered} {view.monthsCovered === 1 ? 'month' : 'months'}. Each month is
        frozen when it ends, so these do not change behind you.
      </Text>

      {view.rows.map((row) => (
        <TrendMetric key={row.metric} row={row} />
      ))}

      <Text className="mt-8 font-body text-xs leading-relaxed text-muted-foreground">
        A month with too little evidence is left blank rather than drawn as zero. Comparisons
        are against your own earlier months, never against anyone else.
      </Text>
    </View>
  );
}

function TrendMetric({ row }: { row: TrendRow }) {
  const stacked = useLargeText();
  // One sentence per metric, so a screen reader hears the shape rather than a
  // row of unlabelled bars.
  const spoken = row.building
    ? `${row.label}: still building, no month has enough behind it yet.`
    : `${row.label}: now ${row.latest}.${row.change ? ` ${row.change}.` : ''} ${row.points
        .filter((p) => p.display)
        .map((p) => `${p.label}, ${p.display}`)
        .join('. ')}`;

  return (
    <View accessible accessibilityLabel={spoken} className="mt-6 border-t border-border pt-4">
      <Text className="font-emphasis text-sm text-muted-foreground">{row.label}</Text>

      {row.building ? (
        <>
          <Text className="mt-1 font-heading text-xl text-muted-foreground">Building</Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            No month has enough behind it yet. It will appear here once one does.
          </Text>
        </>
      ) : (
        <>
          <Text className="mt-1 font-heading text-2xl tabular-nums text-foreground">
            {row.latest}
          </Text>
          {row.change ? (
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              {row.change}
            </Text>
          ) : null}

          {/* The shape, and then the numbers. Bars alone are decoration; a rep
              checking a figure needs to read it. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            className="mt-4 h-16 flex-row items-end gap-1"
          >
            {row.points.map((p) => (
              <View key={p.period} className="flex-1 justify-end">
                {p.fraction === null ? (
                  // A gap, drawn as a gap. Not a zero-height bar, which reads as
                  // a month where the number collapsed.
                  <View className="h-1 w-full rounded-sm bg-border" />
                ) : (
                  <View
                    className="w-full rounded-sm bg-primary"
                    // 6% floor so the lowest month is still visible as a bar
                    // rather than vanishing into the axis.
                    style={{ height: `${6 + p.fraction * 94}%` }}
                  />
                )}
              </View>
            ))}
          </View>

          <View className="mt-2 flex-row gap-1">
            {row.points.map((p) => (
              <Text
                key={p.period}
                numberOfLines={1}
                className="flex-1 text-center font-body text-xs text-muted-foreground"
              >
                {p.label.slice(0, 3)}
              </Text>
            ))}
          </View>

          <View className="mt-3 gap-1">
            {row.points.map((p) => (
              // A month and its figure, side by side — until the reader's text
              // size makes that two columns of fragments, at which point the
              // month sits above its number. "Not enough calls" is the value
              // most likely to force the wrap, and it is also the one a rep most
              // needs to read as a sentence rather than as three broken lines.
              <View
                key={p.period}
                className={
                  stacked ? 'gap-0' : 'flex-row items-baseline justify-between gap-3'
                }
              >
                <Text className="font-body text-sm text-muted-foreground">{p.label}</Text>
                <Text className="font-body text-sm tabular-nums text-foreground">
                  {p.display ?? 'Not enough calls'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
