/**
 * My Progress — the rep's own points.
 *
 * Mirrors the web's MyProgress: a total, an average per session, the number of
 * sessions banked, a plain trend, and the recent sessions each opening its own
 * debrief. Read-only, and reading `agent_point_ledger` directly under RLS, so it
 * works without the backend branch.
 *
 * NO CHART LIBRARY. The trend is a row of bars built from Views, because the
 * point is "is this going up or down", not a plottable dataset. A library would
 * add a native dependency to say something a dozen rectangles already say.
 *
 * EVERY NUMBER HERE IS ABOUT A PERSON'S PERFORMANCE, which is why the honest
 * states matter more than usual: an unread ledger says so rather than showing a
 * zero, and "no points yet" is a real state that is said plainly rather than
 * rendered as a flat chart at zero.
 */
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import { badgeDay, shortDate } from '@/lib/format';
import { bandLabel, type PointRow } from '@/lib/gamification/points';
import { odometerChars } from '@/lib/gamification/odometer';
import { buildArena, milestones, type Milestone } from '@/lib/gamification/arena';
import {
  milestoneLine,
  milestoneStatus,
  type MilestoneDates,
} from '@/lib/gamification/milestone-dates';
import { fetchMilestoneDates, fetchMyPoints } from '@/lib/gamification/points-api';
import { rank, myRank } from '@/lib/gamification/leaderboard';
import { fetchLeaderboard } from '@/lib/gamification/leaderboard-api';
import { ArenaGauge } from '@/components/arena-gauge';
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

export function ArenaPage() {
  /** Side-by-side rows cannot share a line at 200% text. */
  const stacked = useLargeText();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<PointRow[]>([]);
  /**
   * From the caller's own leaderboard row — spec 5.2 reads deals and rank there.
   *
   * NULL WHEN THE BOARD COULD NOT BE READ, not 0. This was `?? 0`, so a failed
   * board read told a rep they had closed NO DEALS — on the one screen that is
   * entirely about their own performance. It is the same lie as a failed load
   * rendering as a zero, and this app has now caught it five times.
   */
  const [deals, setDeals] = useState<number | null>(null);
  const [myPlace, setMyPlace] = useState<number | null>(null);
  /**
   * The five earned-DATES, from the route (spec 5.3).
   *
   * Null until it answers, and null if it never does — which renders as "can't
   * check now" rather than "not earned". A rep who has closed ten deals must not
   * be told otherwise because a request timed out. Kept OUT of the main load
   * path on purpose: the Arena's numbers come straight from the ledger under
   * RLS, so five dates failing must not take the screen down with them.
   */
  const [milestoneDates, setMilestoneDates] = useState<MilestoneDates | null>(null);
  /** Stamped when the data is read, not during render — `Date.now()` in a render
   *  body is an impure call, and the NEW flag only needs the time of the read. */
  const [readAt, setReadAt] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      // NOT a silent early return. Leaving the phase on 'loading' with no user
      // is a spinner that resolves never — the root layout's redirect runs in an
      // effect, so this screen can render for a frame with no user, and would
      // hang outright if the session ever existed without one.
      setPhase('error');
      return;
    }
    setReadAt(Date.now());
    const { rows: fresh, failed } = await fetchMyPoints(userId);
    setRows(fresh);
    // Deals and rank are aggregates the board already computes; recomputing them
    // here would be a second implementation free to disagree with the board.
    const board = await fetchLeaderboard('all');
    const me = board.failed ? null : myRank(rank(board.rows, userId));
    // A rep genuinely on the board with no deals gets 0; an unreadable board
    // gets null, and the screen shows an em dash for it.
    setDeals(board.failed ? null : (me?.deals ?? 0));
    setMyPlace(me?.rank ?? null);
    setPhase(failed ? 'error' : 'ready');
    // LAST, and not awaited into the phase. The screen is already usable at this
    // point; the five dates are an addition to badges that render without them,
    // so a slow or refusing route must not hold the Arena back or fail it.
    void fetchMilestoneDates().then(setMilestoneDates);
  }, [userId]);

  const lastLoad = useRef(0);
  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastLoad.current < REFETCH_AFTER_MS) return;
      lastLoad.current = Date.now();
      void load();
    }, [load]),
  );

  const arena = buildArena(rows, { deals, now: readAt });
  // A badge is earned, not earned, or NOT KNOWABLE. The deal badges depend on
  // the team board, and an unreadable board must not be reported as "no deals".
  const badges = milestones(arena, deals);

  /**
   * The line under one badge.
   *
   * FOUR outcomes, and the order matters. `earned === null` is the deal count
   * being unreadable, which cannot disprove a deal and so wins over anything the
   * dates say. Then: earned with a date, earned without one (the route did not
   * answer — "Earned" is still true and better than a blank), and not yet, which
   * shows what it takes rather than a locked box.
   */
  function badgeLine(m: Milestone, dates: MilestoneDates | null): string {
    if (m.earned === null) return "Can't check now";
    if (!m.earned) return m.requirement;
    const status = milestoneStatus(dates, m.key);
    return status.state === 'earned' ? milestoneLine(status, m.requirement, badgeDay) : 'Earned';
  }

  return (
    <>
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
        {phase === 'loading' ? (
          <View className="items-start gap-3 py-6">
            <ActivityIndicator color={C['muted-foreground']} />
            <Text className="font-body text-base text-muted-foreground">
              Reading your points…
            </Text>
          </View>
        ) : phase === 'error' ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="gap-2 rounded-md border border-destructive px-3 py-3"
          >
            {/* Never an empty ledger: "you have no points" and "we could not
                check" are different things to tell somebody about their own
                performance. */}
            <Text className="font-body text-base leading-relaxed text-destructive">
              Your points could not be read. That is not the same as having none.
            </Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel="Try reading your points again"
              className="min-h-7 justify-center self-start rounded-md border border-primary px-4 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">Try again</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View className="gap-3 py-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              No points yet
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              Points are banked when a recorded call is scored. Record one at a door and it
              appears here once the coach has been through it.
            </Text>
            {/* An empty state gives the action, not just the explanation —
                .claude/rules/copy.md. Without it a rep reads what would fill
                this screen and has no way to start filling it. */}
            <Pressable
              onPress={() => router.push('/(app)/record')}
              accessibilityRole="button"
              accessibilityLabel="Record a call"
              className="min-h-7 justify-center rounded-md border border-primary px-4 py-3 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">Record a call</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-6">
            {/* The pair is bidirectional on the web: the board carries a summary
                strip into here, and rank is a fact about the board, so a rep
                looking at their own standing can get to where it came from. */}
            {myPlace !== null ? (
              <Pressable
                onPress={() => router.push('/(app)/scoreboard')}
                accessibilityRole="button"
                accessibilityLabel={`You are ${myPlace} on the team scoreboard. Opens it.`}
                className="min-h-7 flex-row items-baseline justify-between gap-3 active:opacity-70"
              >
                <Text className="flex-1 font-body text-sm text-muted-foreground">
                  #{myPlace} on your team
                </Text>
                <Text className="font-emphasis text-sm text-primary">Scoreboard</Text>
              </Pressable>
            ) : null}

            <ArenaGauge
              average={arena.average}
              bandText={arena.band ? (bandLabel(arena.band) ?? 'Not scored yet') : 'Not scored yet'}
              sub={
                arena.best === null
                  ? 'No scored call yet'
                  : `Best ${arena.best}${myPlace ? ` · rank #${myPlace}` : ''}`
              }
            />

            {/*
              THE ODOMETER, as the website draws it — spec §2's "grouped digits,
              e.g. 5 4 8".

              This was a plain number, which was the one element on this screen
              that visibly did not match the web. The web puts every digit in its
              own raised tile with the comma as a narrow separator between them,
              and a total that reads as a mechanical counter says something a
              formatted number does not: this went UP, and it keeps going up.

              WHAT IS DELIBERATELY NOT COPIED: the web's inset shadow inside each
              tile. React Native does not render an inset box-shadow dependably
              across both platforms, and a shadow that appears on one and not the
              other would be a worse mismatch than none.

              The digits are `tabular-nums` rather than a monospace face. The web
              reaches for monospace to stop tiles jittering as the number
              changes; tabular figures do the same job in the type this app
              already loads, without adding a font for one row.
            */}
            <View className="items-center gap-2">
              <View className="flex-row items-center gap-1">
                {odometerChars(arena.total).map((c, i) =>
                  c.kind === 'separator' ? (
                    <Text
                      key={`${i}-sep`}
                      className="self-end pb-2 font-heading text-xl text-muted-foreground"
                    >
                      {c.char}
                    </Text>
                  ) : (
                    <View
                      key={`${i}-d`}
                      className="min-w-9 rounded-sm bg-surface-raised px-2 py-2"
                    >
                      <Text className="text-center font-heading text-2xl tabular-nums text-primary">
                        {c.char}
                      </Text>
                    </View>
                  ),
                )}
              </View>
              <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
                Points earned
              </Text>
            </View>

            <View className="flex-row gap-3">
              <Figure
                label="Strong calls"
                value={`${arena.strongSessions}/${arena.sessions}`}
                emphasis={arena.strongSessions > 0}
              />
              <Figure
                label="Deals closed"
                value={deals === null ? '—' : String(deals)}
                emphasis={(deals ?? 0) > 0}
              />
            </View>

            {deals === null ? (
              <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                {/* The dash above needs a reason, or it reads as a rendering
                    fault rather than an honest gap. */}
                Your deal count comes from the team board, which could not be read just now.
                Everything else here is your own record and is up to date.
              </Text>
            ) : null}

            {arena.lastSeven.length >= 2 ? (
              <View className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Your last {arena.lastSeven.length} calls
                </Text>
                <Trend points={arena.lastSeven.map((t) => t.points)} />
                <Text className="font-body text-xs text-muted-foreground">
                  Oldest on the left, out of 100. Corrections are folded into the call they
                  belong to.
                </Text>
              </View>
            ) : null}

            {arena.bestPitches.length > 0 ? (
              <View className="gap-2">
                <Text
                  accessibilityRole="header"
                  className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Your best calls
                </Text>
                {arena.bestPitches.map((b) => (
                  <Pressable
                    key={b.sessionId}
                    onPress={() =>
                      router.push({ pathname: '/(app)/[id]', params: { id: b.sessionId } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${b.points} points${
                      bandLabel(b.band) ? `, ${bandLabel(b.band)}` : ''
                    }, on ${shortDate(b.at)}${b.isNew ? ', from this week' : ''}. Opens the call.`}
                    className={`min-h-7 gap-3 rounded-lg border border-border-control px-3 py-3 active:opacity-70 ${
                  stacked ? '' : 'flex-row items-center justify-between'
                }`}
                  >
                    <View className="flex-1">
                      <Text className="font-strong text-base text-foreground">
                        {b.points} points
                      </Text>
                      {/* Spec §2: the band label BESIDE the date, not the score
                          alone. "87 points" can only be read by somebody who
                          already knows the scale runs to 100 and where the
                          boundaries fall; "Elite · 12 Aug" can be read by the
                          rep it is about. Null when the score cannot be banded,
                          in which case the date stands on its own rather than
                          leaving a stray separator. */}
                      <Text className="mt-0.5 font-body text-sm text-muted-foreground">
                        {bandLabel(b.band) ? `${bandLabel(b.band)} · ` : ''}
                        {shortDate(b.at)}
                      </Text>
                    </View>
                    {b.isNew ? (
                      <Text className="font-emphasis text-xs uppercase tracking-wide text-primary">
                        New
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View className="gap-2">
              <Text
                accessibilityRole="header"
                className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
              >
                Milestones
              </Text>
              {/* Every badge is listed with what it takes, earned or not. An
                  unearned badge whose condition is hidden is just a locked box. */}
              <View className="flex-row flex-wrap gap-2">
                {badges.map((m) => (
                  <View
                    key={m.key}
                    accessible
                    accessibilityLabel={`${m.label}: ${
                      m.earned === null
                        ? `cannot be checked right now. ${m.requirement}`
                        : m.earned
                          ? `earned ${badgeLine(m, milestoneDates)}`
                          : `not yet. ${m.requirement}`
                    }`}
                    className={`rounded-lg border px-3 py-2 ${
                      m.earned ? 'border-primary bg-surface' : 'border-border-control'
                    }`}
                  >
                    <Text
                      className={`font-emphasis text-sm ${
                        m.earned ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {m.label}
                    </Text>
                    <Text className="mt-0.5 font-body text-xs text-muted-foreground">
                      {/* Spec 5.3: an earned badge shows the DAY it was earned,
                          derived server-side from the immutable ledger. Three
                          states, not two — an unreadable count cannot disprove a
                          deal, so it says so instead of going dark. */}
                      {badgeLine(m, milestoneDates)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Figure({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={`flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-3 ${
        emphasis ? 'border-primary bg-surface' : 'border-border-control'
      }`}
    >
      <Text
        className={`font-heading text-xl tabular-nums ${
          emphasis ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </Text>
      <Text className="font-body text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

/**
 * A bar per session, scaled to the biggest.
 *
 * Scaled to the DATA rather than to 100, because a rep whose sessions all sit
 * between 40 and 55 would otherwise see a row of near-identical stubs and learn
 * nothing from it. The caption says what the axis is so the height is never
 * mistaken for a score out of ten.
 */
/**
 * Points per call, as bars.
 *
 * THE SCALE IS ABSOLUTE — `points / 100`, exactly as the build spec words it —
 * and NOT relative to the tallest bar in the window. That difference is the
 * whole honesty of the chart: scaled to the window, a rep whose best call all
 * week was 40 sees a full-height bar and reads it as a great one. Against the
 * real 0-100 range, 40 looks like 40.
 *
 * The trade is that a flat week of low scores looks flat, which is the truth and
 * is the point of showing it.
 */
function Trend({ points }: { points: number[] }) {
  return (
    <View
      accessible
      accessibilityLabel={`Points per call out of 100, oldest first: ${points.join(', ')}`}
      className="h-24 flex-row items-end gap-1"
    >
      {points.map((p, i) => (
        <View
          key={i}
          className={`flex-1 rounded-sm ${
            i === points.length - 1 ? 'bg-primary' : 'bg-border-control'
          }`}
          // Clamped at both ends: a corrected call can total below zero, and a
          // downward bar would be nonsense; a stub keeps it visible and honest.
          style={{ height: `${Math.max(2, Math.min(100, (Math.max(p, 0) / 100) * 100))}%` }}
        />
      ))}
    </View>
  );
}
