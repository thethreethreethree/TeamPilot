/**
 * The door tracker's home screen — page 0 of the two-page pager.
 *
 * Reads down the screen exactly as the founder's mockup does: the date, the
 * greeting, WHY today's number is what it is, the three counts, and then the
 * money. The target card sits ABOVE the dials on purpose — a rep should read why
 * eighty doors before they read how few of them they have knocked.
 *
 * TAPPING A DIAL OPENS THE QUICK-LOG, it does not add one. A knock is a logged
 * event that requires an outcome, and a "presentation" is a recorded pitch — so
 * there is nothing a bare +1 could honestly write. The dials are a live summary
 * of what has actually been logged, and they refresh when the rep comes back.
 *
 * NO LONG-PRESS DECREMENT. Dropped by the 10 September update for the same
 * reason: real counts are immutable logged events, so there is nothing to take
 * back from here. Undo lives in the door log.
 *
 * WHAT IT REFUSES TO DO. With no goal set it does NOT render three empty rings
 * against a target of zero — that reads as "you have achieved none of your goal"
 * to the one rep who has no goal to achieve. It says so, and names the manager
 * who can fix it. Likewise the cash box shows sales, never `$0`, when no value
 * per sale has been set.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { DoorDial } from '@/components/door-dial';
import { useAuth } from '@/lib/auth-context';
import { readMyProfile } from '@/lib/profile';
import { C } from '@/lib/theme';
import { cashBox, dialFill, money, salesToGoalText, targetSentence } from '@/lib/doors/day-target';
import { fetchDayTarget } from '@/lib/doors/day-target-api';
import type { DayTargetView } from '@/lib/doors/day-target-view';
import { deviceTimeZone } from '@/lib/doors/day-target-view';
import {
  NO_GOAL_BODY,
  NO_GOAL_TITLE,
  TAP_HINT,
  TARGET_HEADING,
  UNAVAILABLE_BODY,
  UNAVAILABLE_TITLE,
  dateEyebrow,
  doorScreenState,
  greeting,
} from '@/lib/doors/door-screen-view';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';

export function DoorHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  // Read the same way the existing home does, so both pages of the pager greet
  // the rep with the same name from the same source.
  const [fullName, setFullName] = useState<string | null>(null);
  const online = useOnline();

  const [view, setView] = useState<DayTargetView | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<'unavailable' | 'error' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchDayTarget(deviceTimeZone());
    setLoading(false);
    if (result.ok) {
      setView(result.view);
      setFailure(null);
      setMessage(null);
      return;
    }
    // The previous day's figures are NOT left on screen under a failure — that
    // would attribute yesterday's counts to today.
    setView(null);
    if (result.reason === 'unavailable') {
      setFailure('unavailable');
      return;
    }
    setFailure('error');
    setMessage(
      result.reason === 'failed' && result.message
        ? result.message
        : reachError(null, online, 'your door target'),
    );
  }, [online]);

  // Refetch on every focus: the rep comes back here straight after logging a
  // knock, and a stale count is the one thing this screen cannot show.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The name changes about never, so it is read once rather than on every focus.
  useEffect(() => {
    const id = user?.id;
    if (!id || fullName !== null) return;
    let alive = true;
    void (async () => {
      try {
        const p = await readMyProfile(id);
        if (alive) setFullName(p.fullName);
      } catch {
        // A greeting without a name is "Afternoon", which is fine.
      }
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, fullName]);

  const state = doorScreenState({ loading, failure, salesGoal: view?.salesGoal ?? null });
  const hello = greeting(fullName, user?.email ?? null);
  const eyebrow = view ? dateEyebrow(view.localDate) : '';

  return (
    <ScrollView
      contentContainerClassName="px-5 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C['muted-foreground']}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View className="mt-4">
        {eyebrow ? (
          <Text className="font-body text-sm text-muted-foreground">{eyebrow}</Text>
        ) : null}
        <Text accessibilityRole="header" className="mt-1 font-heading text-3xl text-foreground">
          {hello}
        </Text>
      </View>

      {state === 'loading' ? (
        <View
          accessible
          accessibilityState={{ busy: true }}
          accessibilityLabel="Working out today's target"
          className="mt-10 flex-row items-center gap-2"
        >
          <ActivityIndicator color={C['muted-foreground']} />
          <Text className="font-body text-base text-muted-foreground">
            Working out today&apos;s target…
          </Text>
        </View>
      ) : null}

      {state === 'unavailable' ? (
        <Panel title={UNAVAILABLE_TITLE} body={UNAVAILABLE_BODY} />
      ) : null}

      {state === 'error' ? (
        <Panel title="Could not load today's target" body={message ?? ''} />
      ) : null}

      {state === 'no-goal' ? <Panel title={NO_GOAL_TITLE} body={NO_GOAL_BODY} /> : null}

      {state === 'ready' && view ? (
        <ReadyState view={view} onLog={() => router.push('/(app)/doors')} />
      ) : null}
    </ScrollView>
  );
}

/** One bordered explanation. Used for every state that is not the numbers. */
function Panel({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-6 rounded-xl border border-border-control px-4 py-4">
      <Text className="font-strong text-base text-foreground">{title}</Text>
      {body ? (
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">{body}</Text>
      ) : null}
    </View>
  );
}

function ReadyState({ view, onLog }: { view: DayTargetView; onLog: () => void }) {
  const box = cashBox(view.today.sold, view.soldTarget, view.saleValueCents);

  return (
    <>
      {/* WHY before HOW MANY. */}
      <View className="mt-6 rounded-xl border border-border-control px-4 py-4">
        <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
          {TARGET_HEADING}
        </Text>
        <Text className="mt-2 font-body text-base leading-relaxed text-foreground">
          {targetSentence(
            view.closeRatio,
            view.contactRatio,
            view.soldTarget,
            view.doorsTarget,
            view.usedStarter,
          )}
        </Text>
      </View>

      {/* The funnel, in the order it happens. Wraps rather than squeezing, so a
          large text size makes the row taller instead of clipping a number. */}
      <View className="mt-6 flex-row flex-wrap items-start justify-center gap-2">
        <DoorDial
          label="Doors"
          count={view.today.doors}
          target={view.doorsTarget}
          fill={dialFill(view.today.doors, view.doorsTarget)}
          onTap={onLog}
        />
        <DoorDial
          label="Presentations"
          count={view.today.presentations}
          target={view.presentationsTarget}
          fill={dialFill(view.today.presentations, view.presentationsTarget)}
          onTap={onLog}
        />
        <DoorDial
          label="Sold"
          count={view.today.sold}
          target={view.soldTarget}
          fill={dialFill(view.today.sold, view.soldTarget)}
          onTap={onLog}
        />
      </View>

      <Text className="mt-3 text-center font-body text-sm text-muted-foreground">{TAP_HINT}</Text>

      {/* The cash box. Money only when a manager has set a value per sale. */}
      <View className="mt-6 rounded-xl border border-border-control px-4 py-4">
        {box.kind === 'money' ? (
          <View className="flex-row flex-wrap items-end justify-between gap-3">
            <View>
              <Text className="font-body text-sm text-muted-foreground">Earned today</Text>
              <Text className="mt-1 font-heading text-4xl tabular-nums text-primary">
                {money(box.earnedCents)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-body text-sm tabular-nums text-muted-foreground">
                {money(box.perSaleCents)} per sale
              </Text>
              <Text className="mt-1 font-emphasis text-base tabular-nums text-foreground">
                {box.goalMet ? 'Goal met' : `${money(box.toGoalCents)} to goal`}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text className="font-body text-sm text-muted-foreground">Sales to goal</Text>
            <Text className="mt-1 font-heading text-2xl text-foreground">
              {salesToGoalText(box.remaining, box.goalMet)}
            </Text>
          </>
        )}
      </View>
    </>
  );
}
