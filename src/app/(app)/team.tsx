/**
 * The team roster — the one screen in this app about other people.
 *
 * WHAT IT IS FOR. A manager opens this to find out who needs a conversation
 * today. That is the whole job: not a leaderboard, not a ranking, not a monthly
 * review. So anyone the server has flagged appears first and everyone else keeps
 * the server's own order.
 *
 * "SLIPPING" MEANS AGAINST THEMSELVES. The server compares a rep to their own
 * recent months, never to the team, and the copy carries that in every place it
 * appears. A manager who reads it as a ranking will use it as one, and the rep
 * on the wrong end of that conversation will be right to be annoyed.
 *
 * A NEW REP IS NEVER FLAGGED. There is nothing to have slipped from. The screen
 * still shows they are establishing a baseline, because that is useful — but as
 * a fact about their tenure, not a problem with their work.
 *
 * IT IS MANAGER-GATED SERVER-SIDE. A rep without access gets a 403, and this
 * says so plainly and stops offering rather than leaving them tapping.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { coachGet } from '@/lib/coach-api';
import { buildTeamView, type TeamRow, type TeamView } from '@/lib/team-view';
import type { TeamResponse } from '@/types/backend';
import { useOnline, isOffline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { useAuth } from '@/lib/auth-context';
import { readCachedTeam, writeCachedTeam } from '@/lib/sync/team-cache';
import { clockTime, shortDate } from '@/lib/format';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { blockedState } from '@/lib/blocked-state';
import { useLargeText } from '@/lib/use-large-text';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', 'your team');

type State =
  | { phase: 'loading' }
  /** `cachedAt` is set only when this roster came off the device. Said loudly,
   *  because a stale flag is one a manager would act on. */
  | { phase: 'ready'; view: TeamView; cachedAt: Date | null }
  | { phase: 'not-a-manager' }
  | { phase: 'needs-shim' }
  | { phase: 'error'; message: string };

export default function TeamScreen() {
  const [state, setState] = useState<State>({ phase: 'loading' });
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();
  const offline = isOffline(online);

  const load = useCallback(async () => {
    try {
      const res = await coachGet<TeamResponse>('/api/coach/kpi/team');
      setState({ phase: 'ready', view: buildTeamView(res), cachedAt: null });
      if (userId) writeCachedTeam(userId, res);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      // A cached roster is offered only for a CONNECTION failure. On a 403 the
      // answer is "this is not for you" and showing a roster anyway would
      // contradict the server; on a 401 nothing here is trustworthy yet.
      if (status !== 401 && status !== 403) {
        const cached = userId ? await readCachedTeam(userId) : null;
        if (cached) {
          setState({ phase: 'ready', view: buildTeamView(cached.res), cachedAt: cached.at });
          return;
        }
      }
      // 403 is the manager gate and 401 is the shim. They read identically to a
      // rep if collapsed, and they mean opposite things: one is "this is not for
      // you", the other is "the server turned the request down".
      if (status === 403) {
        setState({ phase: 'not-a-manager' });
        return;
      }
      if (status === 401) {
        // Not always the shim: a revoked or expired session arrives as a 401
        // too, and that rep needs to sign in rather than wait for a deploy.
        const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
        setState(
          why === 'signed-out'
            ? { phase: 'error', message: authFailureMessage('signed-out') }
            : { phase: 'needs-shim' },
        );
        return;
      }
      setState({
        phase: 'error',
        message: reachError(e, online, 'your team'),
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
              Your team&apos;s figures are worked out on the server, so they need signal.
              Pull down once you have a bar.
            </Text>
          </View>
        ) : null}

        {state.phase === 'loading' ? (
          <View className="mt-16 items-center">
            <ActivityIndicator color={C.primary} accessibilityLabel="Loading your team" />
          </View>
        ) : null}

        {state.phase === 'not-a-manager' ? (
          <View className="mt-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              This is for managers
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              Your account does not have access to other people&apos;s figures. Nothing is
              wrong — that is how it is set up. Your own numbers are on the Your numbers
              screen.
            </Text>
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
              Could not load your team
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
          <Roster view={state.view} cachedAt={state.cachedAt} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Roster({ view, cachedAt }: { view: TeamView; cachedAt: Date | null }) {
  const saved = cachedAt ? (
    // PROMINENT, but not an error. `destructive` is this app's error colour, and
    // a saved copy is not a failure — nothing went wrong, the figures are simply
    // from earlier. Marking it as an error spends the one colour that means
    // "something is broken" on a routine state, which is how a rep learns to
    // ignore it on the screen where it IS broken.
    //
    // The assertive announcement stays. Everywhere else in this app a stale copy
    // costs a slightly out-of-date number; here it costs a manager walking into
    // a conversation with a rep about a figure that has already turned around.
    // That is worth interrupting a screen reader for.
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="mt-4 rounded-md border border-primary px-3 py-3"
    >
      <Text className="font-strong text-base text-foreground">Saved copy</Text>
      <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
        From {shortDate(cachedAt.toISOString())} at {clockTime(cachedAt.toISOString())}. Someone
        flagged here may already have turned it around — check with signal before you raise it
        with them.
      </Text>
    </View>
  ) : null;

  if (view.rows.length === 0) {
    return (
      <View className="mt-6">
        {saved}
        <Text accessibilityRole="header" className="mt-4 font-heading text-xl text-foreground">
          Nobody to show yet
        </Text>
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          Reps appear here once they are on your team and have started logging calls.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {saved}
      <Text className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
        {view.slippingCount === 0
          ? 'Nobody is down against their own recent months.'
          : `${view.slippingCount} ${view.slippingCount === 1 ? 'rep is' : 'reps are'} down against their own recent months, by ${view.alertDropPct}% or more. Each is compared to themselves, never to the team.`}
      </Text>

      {view.rows.map((row) => (
        <Member key={row.agentId} row={row} />
      ))}

      <Text className="mt-8 font-body text-xs leading-relaxed text-muted-foreground">
        These are the same figures the website shows, worked out in the same place. A rep with
        too few calls shows as building rather than as a number — a small sample says nothing
        about how someone is doing.
      </Text>
    </View>
  );
}

function Member({ row }: { row: TeamRow }) {
  const router = useRouter();
  // One sentence per rep, so a screen reader hears a person and their state
  // rather than a row of disconnected numbers.
  const spoken = [
    row.name,
    row.slippingNote ?? null,
    row.conversion.display
      ? `Conversion rate ${row.conversion.display}`
      : 'Conversion rate still building',
    row.quota.display ? `Quota attainment ${row.quota.display}` : null,
    `${row.sessionCount} ${row.sessionCount === 1 ? 'call' : 'calls'}`,
  ]
    .filter(Boolean)
    .join('. ');

  const stacked = useLargeText();

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      className={`mt-4 rounded-md border px-4 py-4 ${
        row.slipping ? 'border-primary' : 'border-border-control'
      }`}
    >
      <Text className="font-strong text-base text-foreground">{row.name}</Text>

      {row.slippingNote ? (
        <Text className="mt-1 font-body text-sm leading-relaxed text-foreground">
          {row.slippingNote}
        </Text>
      ) : null}

      {row.establishingBaseline ? (
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          Still building a baseline — too few calls yet to compare against.
        </Text>
      ) : null}

      {/*
        TWO COLUMNS AT THE DEFAULT SIZE, ONE AT AN ACCESSIBILITY SIZE.

        Each column is half of a phone's width minus the gap — about 160pt. That
        is ample for "Conversion" over "62%" at 12pt, and nowhere near enough at
        three times that: an uppercase, wide-tracked label and a heading-sized
        number both need the full width, so side by side they wrap into a stack
        of fragments. Nothing is truncated, which is exactly why it survives a
        layout check and is only visible to the person who needs large text.

        Same treatment as the numbers screen and the session list, for the same
        reason — a manager reading this in the sun is not an edge case.
      */}
      <View className={`mt-3 ${stacked ? 'gap-3' : 'flex-row gap-6'}`}>
        <View className={stacked ? undefined : 'flex-1'}>
          <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
            Conversion
          </Text>
          <Text className="mt-1 font-heading text-xl tabular-nums text-foreground">
            {row.conversion.display ?? 'Building'}
          </Text>
        </View>
        <View className={stacked ? undefined : 'flex-1'}>
          <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
            Quota
          </Text>
          <Text className="mt-1 font-heading text-xl tabular-nums text-foreground">
            {row.quota.display ?? 'Building'}
          </Text>
        </View>
      </View>

      {/*
        A SEPARATE CONTROL, NOT A TAPPABLE CARD.

        This screen's job is reading — who needs a conversation today — and the
        card above is one accessible element with one spoken sentence. Making the
        whole thing pressable would turn that sentence into a button label and
        put an action where a manager is scanning. So the one thing they might
        DO from here is its own control, with its own name.

        It carries the rep's name into the screen so the heading can say whose
        goal is being set, rather than showing a manager a bare form.
      */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(app)/rep-goal/[repId]',
            params: { repId: row.agentId, name: row.name },
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Set the daily goal for ${row.name}`}
        className="mt-4 min-h-7 justify-center border-t border-border pt-3 active:opacity-70"
      >
        <Text className="font-emphasis text-base text-primary">Set daily goal</Text>
      </Pressable>

      <Text className="mt-3 font-body text-sm text-muted-foreground">
        {row.sessionCount} {row.sessionCount === 1 ? 'call' : 'calls'} logged
      </Text>
    </View>
  );
}
