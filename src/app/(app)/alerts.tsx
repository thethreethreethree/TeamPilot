/**
 * Alerts — a manager's strong-session and closed-deal notifications (spec 5.3).
 *
 * ONLY MANAGERS HAVE ANY. The table's SELECT policy is `recipient_id =
 * auth.uid()`, so a rep opening this sees an empty list rather than an error:
 * there is nothing addressed to them, which is a real state and not a failure.
 * The screen says that plainly instead of implying something went wrong.
 *
 * EVERY ROW IS DRAWN FROM `payload`, never a join — so an alert about a rep who
 * has since left the company still renders, rather than collapsing to a blank.
 *
 * MARKING READ WORKS FROM THE PHONE. This comment used to say it did not, and
 * that was wrong once the route was checked rather than assumed: the table has
 * no client write policy — true — but `POST /api/coach/gamification/notifications`
 * performs the write with the service role PINNED to `recipient_id = the caller`,
 * and it resolves a caller from a mobile Bearer token as well as a web cookie.
 * So a manager can mark read here today, and the failure message no longer
 * blames a deploy for what is usually an expired session.
 */
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { clockTime, shortDate } from '@/lib/format';
import {
  isUnread,
  markReadLocally,
  notificationLine,
  unreadCount,
  type ManagerNotification,
} from '@/lib/gamification/notifications';
import {
  fetchNotifications,
  markNotificationsRead,
  NOTIFICATIONS_LIMIT,
  subscribeManagerNotifications,
} from '@/lib/gamification/notifications-api';
import { useAuth } from '@/lib/auth-context';
import { C } from '@/lib/theme';

/** The same refetch floor the other loading screens use. */
const REFETCH_AFTER_MS = 15_000;

/**
 * The fallback poll (spec 6).
 *
 * Sixty seconds, which is the spec's own figure and the right order of
 * magnitude: an alert about a rep's strong session is not a message a manager
 * is waiting on with a stopwatch, and a phone polling faster than this while
 * the screen is open is spending battery to shave seconds off something
 * realtime already covers when the socket is up.
 */
const POLL_MS = 60_000;

type Phase = 'loading' | 'ready' | 'error';

export default function AlertsScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<ManagerNotification[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  // Which single alerts are in flight. A Set, not a boolean: a manager can tap
  // two rows before the first answers, and each control must show its own state.
  const [markingOne, setMarkingOne] = useState<ReadonlySet<string>>(new Set());

  const load = useCallback(async () => {
    const { rows: fresh, failed } = await fetchNotifications();
    setRows(fresh);
    setPhase(failed ? 'error' : 'ready');
  }, []);

  const lastLoad = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastLoad.current >= REFETCH_AFTER_MS) {
        lastLoad.current = Date.now();
        void load();
      }

      /**
       * Spec 6: live alerts, with a poll behind them.
       *
       * BOTH, and the poll is the one that is guaranteed. A phone's socket
       * drops when it changes cell or sleeps in a pocket, and it does not
       * announce that it has — a manager watching a screen that has quietly
       * stopped listening is worse off than one who knows it refreshes every
       * minute. Realtime only shortens the gap.
       *
       * Everything here is scoped to FOCUS. A subscription and an interval left
       * running behind a screen nobody is looking at spends a manager's battery
       * and data on a list they cannot see; both are torn down on the way out.
       */
      const stop = userId ? subscribeManagerNotifications(userId, () => void load()) : null;
      const timer = setInterval(() => {
        lastLoad.current = Date.now();
        void load();
      }, POLL_MS);

      return () => {
        stop?.();
        clearInterval(timer);
      };
    }, [load, userId]),
  );

  const unread = unreadCount(rows);

  const markOne = useCallback(
    async (id: string) => {
      if (markingOne.has(id)) return;
      setMarkingOne((prev) => new Set(prev).add(id));
      setNotice(null);
      const failure = await markNotificationsRead({ ids: [id] });
      setMarkingOne((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (failure) {
        setNotice(failure);
        return;
      }
      // Applied locally rather than refetched: the badge must clear the instant
      // the server confirms, and a manager clearing several in a row should not
      // pay for a round trip each time. Nothing is assumed before it confirms.
      setRows((prev) => markReadLocally(prev, [id], new Date().toISOString()));
    },
    [markingOne],
  );

  const markAll = useCallback(async () => {
    if (marking) return;
    setMarking(true);
    setNotice(null);
    const failure = await markNotificationsRead({ all: true });
    setMarking(false);
    if (failure) {
      setNotice(failure);
      return;
    }
    // Bypass the floor: the badge must clear the moment it actually cleared.
    lastLoad.current = 0;
    await load();
  }, [marking, load]);

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
              // An explicit pull is never throttled: the manager asked.
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
        {phase === 'loading' ? (
          <View className="items-start gap-3 py-6">
            <ActivityIndicator color={C['muted-foreground']} />
            <Text className="font-body text-base text-muted-foreground">Reading your alerts…</Text>
          </View>
        ) : phase === 'error' ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="gap-3 rounded-md border border-destructive px-3 py-3"
          >
            <Text className="font-body text-base leading-relaxed text-destructive">
              Your alerts could not be read. That is not the same as having none.
            </Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel="Try reading your alerts again"
              className="min-h-7 justify-center self-start rounded-md border border-primary px-4 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">Try again</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View className="gap-3 py-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              No alerts
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              {/* An empty list is the ordinary state for a rep, not a fault. */}
              Alerts go to managers when someone on their team has a strong call or closes a
              deal. If you are not managing a team, there will be nothing here.
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="flex-1 font-body text-sm text-muted-foreground">
                {unread === 0
                  ? `${rows.length} ${rows.length === 1 ? 'alert' : 'alerts'}, all read.`
                  : `${unread} unread of ${rows.length}.`}
              </Text>
              {unread > 0 ? (
                <Pressable
                  onPress={() => void markAll()}
                  disabled={marking}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: marking, busy: marking }}
                  accessibilityLabel="Mark every alert as read"
                  className="min-h-7 justify-center active:opacity-70 disabled:opacity-50"
                >
                  <Text className="font-emphasis text-sm text-primary">
                    {marking ? 'Marking…' : 'Mark all read'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {notice ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="font-body text-sm leading-relaxed text-muted-foreground"
              >
                {notice}
              </Text>
            ) : null}

            {rows.map((n) => {
              const line = notificationLine(n);
              const fresh = isUnread(n);
              return (
                <View
                  key={n.id}
                  className={`rounded-lg border ${
                    fresh ? 'border-primary bg-surface' : 'border-border-control'
                  }`}
                >
                  {/* Two separate controls, not one. A manager who wants to clear
                      an alert should not have to open the call to do it, and an
                      alert with no call attached had no way to be cleared at all. */}
                  <Pressable
                    onPress={() =>
                      n.sessionId
                        ? router.push({ pathname: '/(app)/[id]', params: { id: n.sessionId } })
                        : undefined
                    }
                    disabled={!n.sessionId}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !n.sessionId }}
                    accessibilityLabel={`${fresh ? 'Unread. ' : ''}${line.title}. ${line.detail} ${shortDate(
                      n.createdAt,
                    )}.${n.sessionId ? ' Opens the call.' : ''}`}
                    // min-h-7 (48dp) rather than trusting the three lines of
                    // text to be tall enough: an alert with a short title and no
                    // detail would otherwise fall under the touch-target floor.
                    className="min-h-7 gap-1 px-3 py-3 active:opacity-70 disabled:opacity-100"
                  >
                    <Text className="font-strong text-base text-foreground">{line.title}</Text>
                    <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                      {line.detail}
                    </Text>
                    <Text className="font-body text-xs text-muted-foreground">
                      {shortDate(n.createdAt)}, {clockTime(n.createdAt)}
                      {n.sessionId ? '' : ' · no call attached'}
                    </Text>
                  </Pressable>

                  {fresh ? (
                    <Pressable
                      onPress={() => void markOne(n.id)}
                      disabled={markingOne.has(n.id)}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: markingOne.has(n.id),
                        busy: markingOne.has(n.id),
                      }}
                      accessibilityLabel={`Mark read: ${line.title}`}
                      className="min-h-7 justify-center border-t border-border-control px-3 active:opacity-70 disabled:opacity-50"
                    >
                      <Text className="font-emphasis text-sm text-primary">
                        {markingOne.has(n.id) ? 'Marking…' : 'Mark read'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

            {rows.length >= NOTIFICATIONS_LIMIT ? (
              <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                Showing your {NOTIFICATIONS_LIMIT} most recent alerts. Older ones are on the
                website.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
