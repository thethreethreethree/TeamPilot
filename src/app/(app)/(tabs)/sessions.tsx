/**
 * The rep's own coaching sessions.
 *
 * Reads DIRECTLY from Supabase under the Row-Level Security the backend already
 * enforces, so there is no endpoint to build and a foreign row is not merely
 * hidden — it is never returned.
 *
 * STALE-WHILE-REVALIDATE, per 03-DATA-MODEL-AND-SYNC.md: the cached list paints
 * immediately, the network read runs behind it, and the two reconcile. A rep
 * between calls should never watch a spinner to find out what they already saw.
 * Cached content is labelled with the time it was written — a cache is a
 * convenience, never a lie.
 *
 * GROUPED BY DAY, and grouped ON THE DEVICE. The same document names this as
 * work the app should do locally: "compute locally: pure presentation — grouping
 * a rep's own already-fetched sessions by day". The contract records the real
 * content count as dozens per rep, so a flat scroll is the wrong shape — a rep
 * looking for "the one from Tuesday" is looking for a day, not an index.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  SESSIONS_PAGE,
  type SessionListRow,
  listMySessions,
  repNamesFor,
  subscribeMySessions,
} from '@/lib/sync/sessions';
import { analysisChip, analysisSpoken, analysisState } from '@/lib/session-analysis';
import {
  ONE_SIDED_CHIP,
  ONE_SIDED_SPOKEN,
  UNFINISHED_CHIP,
  UNFINISHED_SPOKEN,
} from '@/lib/capture-issue';
import { voiceQuestionWording } from '@/lib/voice-question';
import { ownerLabel, ownerSpoken } from '@/lib/session-owner';
import { readCachedSessions, writeCachedSessions } from '@/lib/sync/cache';
import { listPendingAttributions, type PendingAttribution } from '@/lib/audio/attribution-store';
import { listOutbox, outboxStopped, type OutboxEntry } from '@/lib/sync/outbox';
// The sign-out sweep lives in ONE place. This screen used to import each store's
// clear function and run them itself; those imports outlived the extraction and
// made it look as though sign-out were still handled here, in a second copy that
// would quietly fall behind whenever a new store was added.
import { signOutMessage, strandedAtSignOut, sweepDeviceCopies } from '@/lib/sign-out-flow';
import { countPending } from '@/lib/audio/recording-store';
import { autoSendStopped } from '@/lib/audio/auto-send';
import { useAuth } from '@/lib/auth-context';
import { Attention, type AttentionItem } from '@/components/attention';
import { SearchField } from '@/components/search-field';
import { C } from '@/lib/theme';
import { useLargeText } from '@/lib/use-large-text';
import { clockTime, duration, money, outcomeLabel, shortDate } from '@/lib/format';
import { groupByDay } from '@/lib/group-sessions';
import { useOnline, isOffline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';

/** Below this many sessions a search field is furniture, not help. */
const SEARCH_THRESHOLD = 8;

/** How long a network read stays fresh enough not to spend another on it. */
const REFETCH_AFTER_MS = 15_000;

export default function SessionsScreen() {
  const router = useRouter();
  const [pendingRecordings, setPendingRecordings] = useState(0);
  /** Show only calls with no outcome recorded. Off by default: the list is a
   *  record first, and a filter left on is a list that lies by omission. */
  const [onlyUnscored, setOnlyUnscored] = useState(false);
  /** True while older sessions exist that have not been fetched yet. Everything
   *  derived from the list — search, the unscored count — is only as complete as
   *  what has been loaded, so the screen has to be able to say so. */
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { user, signOut } = useAuth();
  const stacked = useLargeText();
  const userId = user?.id ?? null;
  /**
   * Names for the reps whose calls are NOT the viewer's own.
   *
   * A rep's list is entirely their own, so this stays empty and no request is
   * made. A manager's list is the team's, and without this every row is
   * labelled only by the customer — 196 sessions from 3 reps, indistinguishable.
   */
  const [repNames, setRepNames] = useState<Map<string, string>>(new Map());

  const [sessions, setSessions] = useState<SessionListRow[] | null>(null);
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const alive = useRef(true);
  /** When the last successful network read landed, so coming back to this screen
   *  does not refetch on every glance. */
  const lastLoad = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);


  /** True when the server is refusing uploads, so "they send automatically" is
   *  not a promise this screen can make. */
  const [sendingHalted, setSendingHalted] = useState(false);
  /** The outbox's own hard stop, so the copy below cannot promise a send it
   *  will not make — the same guard the recordings item already has. */
  const [writesHalted, setWritesHalted] = useState(false);
  /** Transcripts that cannot tell the rep apart until they say which voice is
   *  theirs. Read on focus, because uploads finish in the background. */
  const [needVoice, setNeedVoice] = useState<PendingAttribution[]>([]);
  /**
   * Outcomes and names typed with no signal, still on the phone.
   *
   * Surfaced HERE and not only on the call they belong to, because the rep who
   * needs to know is the one who has moved on. They marked a call in a stairwell
   * and are now three appointments away; if the only place that says so is the
   * screen they left, the app is again relying on someone remembering.
   */
  const [queuedWrites, setQueuedWrites] = useState<OutboxEntry[]>([]);
  /**
   * The queued instruction per call, for the rows.
   *
   * A call can have both a queued outcome and a queued rename. The outcome wins
   * the single slot the row has, because it is what the rep scans this list for
   * and what every figure on the numbers screen is computed from; a name that has
   * not sent is visible on the call itself.
   */
  const queuedBySession = useMemo(() => {
    const byId = new Map<string, OutboxEntry>();
    for (const e of queuedWrites) {
      const held = byId.get(e.sessionId);
      if (!held || (held.kind !== 'outcome' && e.kind === 'outcome')) byId.set(e.sessionId, e);
    }
    return byId;
  }, [queuedWrites]);

  const countWaiting = useCallback(async () => {
    setPendingRecordings(userId ? await countPending(userId) : 0);
    setSendingHalted(autoSendStopped());
    setNeedVoice(userId ? await listPendingAttributions(userId) : []);
    setQueuedWrites(userId ? await listOutbox(userId) : []);
    setWritesHalted(outboxStopped());
  }, [userId]);

  /**
   * Fetch the list.
   *
   * NO SYNCHRONOUS setState, on purpose. This used to take a
   * 'silent' | 'visible' mode and flip the refresh spinner on its first line —
   * which meant an effect calling it set state during render and triggered the
   * cascading render React warns about. The spinner belongs to the gesture that
   * asked for it, so `refresh` below owns it and this owns only the data.
   */
  // Read here, above `load`, because `load` reports on it. Declared further
  // down it would be captured stale by the memo and the screen would blame
  // the signal for a server fault — the 4 September full-bars report.
  const online = useOnline();

  const load = useCallback(
    async () => {
      if (!userId) return;
      try {
        const { rows, hasMore: more } = await listMySessions();
        if (!alive.current) return;
        lastLoad.current = Date.now();
        setSessions(rows);
        setHasMore(more);
        setCachedAt(null); // live now, not cached — the label goes away
        setError(null);
        writeCachedSessions(userId, rows);
      } catch (e) {
        if (!alive.current) return;
        // Honest failure: say what happened and what to do. Never a spinner forever.
        setError(
          reachError(e, online, 'your sessions'),
        );
        // The cached list, if any, stays on screen behind the notice — losing
        // what the rep could already see would be a worse answer than a stale one.
        setSessions((prev) => prev ?? []);
      }
    },
    [userId, online],
  );

  /**
   * Look up the owners of any rows that are not the viewer's own.
   *
   * Keyed on the ids actually on screen, so paging in more sessions fetches only
   * the names it still lacks, and a rep's own list never asks at all.
   */
  useEffect(() => {
    if (!userId || !sessions) return;
    const missing = Array.from(
      new Set(
        sessions
          .map((s) => s.agent_id)
          .filter((id): id is string => !!id && id !== userId && !repNames.has(id)),
      ),
    );
    if (missing.length === 0) return;
    let alive = true;
    void (async () => {
      const found = await repNamesFor(missing);
      if (!alive || found.size === 0) return;
      setRepNames((prev) => new Map([...prev, ...found]));
    })();
    return () => {
      alive = false;
    };
  }, [sessions, userId, repNames]);

  /** Pull-to-refresh and Retry: the spinner belongs to the gesture. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (alive.current) setRefreshing(false);
    }
  }, [load]);

  /**
   * Coming back to this screen refetches, not just recounts.
   *
   * A recording that sent while the rep was on another screen creates a session
   * on the server, and realtime is documented as very likely off for this
   * backend — so without this the call they just sent is simply absent from
   * their own list until they think to pull down. The floor stops a query firing
   * every time they glance away and back.
   */
  useFocusEffect(
    useCallback(() => {
      countWaiting();
      if (Date.now() - lastLoad.current >= REFETCH_AFTER_MS) void load();
    }, [countWaiting, load]),
  );

  /**
   * Fetch the next page.
   *
   * De-duplicates by id: offset paging repeats a row when a session is inserted
   * while the rep is scrolling, and a duplicate here is not just a React key
   * warning — it is the same call listed twice in their own history.
   */
  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const current = sessions ?? [];
      const { rows, hasMore: more } = await listMySessions(SESSIONS_PAGE, current.length);
      if (!alive.current) return;
      const seen = new Set(current.map((r) => r.id));
      setSessions([...current, ...rows.filter((r) => !seen.has(r.id))]);
      setHasMore(more);
    } catch {
      // Older pages are an extra, not the screen. The rep keeps what they have
      // and the control stays available to try again.
    } finally {
      if (alive.current) setLoadingMore(false);
    }
  }, [userId, loadingMore, hasMore, sessions]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    // Paint the cache first, then let the network correct it.
    (async () => {
      const cached = await readCachedSessions(userId);
      if (cancelled || !alive.current) return;
      // Only if the network has not already answered — a fast network must not
      // be overwritten by a slower disk read.
      /**
       * A CACHED ROW CARRIES NO ANALYSIS STATE, deliberately.
       *
       * The cache holds what the server said when it was written. A segment
       * count from then is stale by definition — the coaching may well have
       * landed since — and "Being analysed" painted from a stale cache would be
       * a false statement about a call that is already finished.
       *
       * So cached rows come back as `segmentCount: null`, which reads as
       * "unknown" and draws nothing. The line appears a moment later when the
       * network answers, which is the only source that can know.
       */
      setSessions((prev) =>
        prev === null && cached
          ? // Same reasoning as `segmentCount`: a cached row cannot know whether
            // the recording was one-sided, and a chip painted from a stale cache
            // would be a claim about a call that may since have been rescued.
            // `unattributedCount` is null for the same reason: the rep may have
            // answered the voice question on another device since this was cached,
            // and a stale "Needs your voice" would send them to a tap that 409s.
            cached.rows.map((r) => ({
              ...r,
              segmentCount: null,
              readIssue: null,
              unattributedCount: null,
            }))
          : prev,
      );
      setCachedAt((prev) => (prev === null && cached ? cached.at : prev));
    })();

    // No initial load here. The focus effect above already fetches when
    // `lastLoad` is stale, and it starts at 0 — so a tab receiving focus on
    // mount was firing listMySessions TWICE on every cold open. This effect
    // owns the cache paint and the subscription; the focus effect owns fetching.
    // A session recorded on another device lands here without a manual refresh.
    const stop = subscribeMySessions(() => void load());
    return () => {
      cancelled = true;
      stop();
    };
  }, [userId, load]);

  /**
   * Signing out drops the cached list, so the next launch needs signal to show
   * anything at all. For a rep at a door with one bar, an accidental tap on a
   * control sitting directly under the one they meant is expensive — so it asks.
   * The confirmation names the actual consequence rather than saying "are you sure".
   */
  async function onSignOut() {
    // The words and the sweep both live in sign-out-flow.ts now, because the
    // Account screen signs out too and two copies of a security sweep is how one
    // of them quietly stops clearing a store somebody added later.
    const stranded = await strandedAtSignOut(userId);
    Alert.alert('Sign out?', signOutMessage(stranded), [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await sweepDeviceCopies(userId);
          await signOut();
        },
      },
    ]);
  }

  const offline = isOffline(online);

  // Memoised because `sessions ?? []` builds a NEW array every render when the
  // list is null, which made every downstream useMemo recompute on every render
  // — including the unscored filter that drives the attention list.
  const all = useMemo(() => sessions ?? [], [sessions]);

  /**
   * Calls with no outcome recorded.
   *
   * These are the quiet problem behind an empty KPI board: conversion rate is
   * sold divided by opportunities, so a session with no outcome contributes to
   * nothing. A rep can make sale after sale and watch their numbers sit at
   * "building" with no error anywhere explaining why. Counting them is the only
   * way that becomes visible.
   *
   * A call whose outcome is sitting in the queue is NOT unscored. The rep has
   * answered; only the network has not caught up. Listing it here would send
   * them to do again the thing they already did, and the second answer would
   * simply replace the first in the same queue — work for nothing, and a fair
   * reason to stop trusting the count.
   */
  const unscored = useMemo(
    () =>
      all.filter(
        (s) => !s.outcome && queuedBySession.get(s.id)?.kind !== 'outcome',
      ),
    [all, queuedBySession],
  );

  /**
   * The filter lets go of itself when it has nothing left to show.
   *
   * Scoring the last unscored call while the filter is on would otherwise leave
   * a rep looking at an empty list telling them they have no sessions — which is
   * untrue, and not a state they chose.
   *
   * DERIVED, NOT SET IN AN EFFECT. It was an effect, and an effect runs AFTER
   * the render that needed it: there was one frame showing the filter on and the
   * list empty — the exact "you have no sessions" flash this is meant to
   * prevent, just brief enough to look like a glitch rather than a bug. Computing
   * it during render means that frame never exists.
   */
  const filtering = onlyUnscored && unscored.length > 0;

  const visible = filtering ? unscored : all;

  /**
   * What needs the rep, most urgent first — see components/attention.tsx for why
   * this is one ordered list rather than four banners.
   *
   * THE ORDER IS AN ARGUMENT. A call with no voice picked reads as nobody in
   * particular saying everything, and the coach reads it that way too, so the
   * transcript is worth almost nothing until it is answered. A recording still on
   * the phone is the only copy of a conversation that cannot be re-had. A queued
   * change is safe, just not visible to anyone else yet. A call with no outcome
   * costs only that it counts toward nothing — recoverable at any time. Damage if
   * ignored, descending.
   */
  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    if (needVoice.length > 0) {
      const one = needVoice.length === 1;
      items.push({
        key: 'voice',
        tone: 'urgent',
        title: `${needVoice.length} ${one ? 'call needs' : 'calls need'} a voice picked`,
        body:
          'Until you say which voice is yours, the transcript cannot tell you and the customer apart — and neither can the coach.' +
          (needVoice[0].label ? ` Starting with ${needVoice[0].label}.` : ''),
        short: `${needVoice.length} ${one ? 'call needs' : 'calls need'} a voice picked`,
        spoken: `${needVoice.length} ${one ? 'call needs' : 'calls need'} you to say which voice is yours. Open the first one.`,
        onPress: () =>
          router.push({ pathname: '/(app)/[id]', params: { id: needVoice[0].sessionId } }),
      });
    }

    if (pendingRecordings > 0) {
      const one = pendingRecordings === 1;
      items.push({
        key: 'recordings',
        tone: 'urgent',
        title: `${pendingRecordings} ${one ? 'recording' : 'recordings'} still on this phone`,
        // Only promised when it is true. Telling a rep their call will send
        // itself while the server is refusing every upload is the kind of
        // reassurance that costs trust when it turns out to be wrong.
        body:
          `${one ? 'It has' : 'They have'} not reached the server yet. ` +
          (sendingHalted
            ? `The server has been turning sends down, so ${one ? 'it is' : 'they are'} being held safely here.`
            : `Name ${one ? 'it' : 'them'} and ${one ? 'it sends' : 'they send'} automatically.`),
        short: `${pendingRecordings} ${one ? 'recording' : 'recordings'} not sent`,
        spoken: `${pendingRecordings} ${one ? 'recording' : 'recordings'} still on this phone. Open them.`,
        onPress: () => router.push('/(app)/recordings'),
      });
    }

    if (queuedWrites.length > 0) {
      const one = queuedWrites.length === 1;
      items.push({
        key: 'queued',
        title: `${queuedWrites.length} ${one ? 'change' : 'changes'} still on this phone`,
        // Deliberately NOT "your numbers are wrong". The figures are a correct
        // account of what the server has; what is missing is an instruction that
        // has not arrived. Saying which is which is the difference between a rep
        // who waits and a rep who re-enters everything.
        body:
          `${one ? 'An outcome or name' : 'Outcomes or names'} you set without signal. ` +
          // Only promised when it is true. The recordings item above already
          // guards this and this one did not, so a rep whose outbox had hit its
          // hard stop was told their changes send themselves — the exact
          // reassurance that costs trust when it turns out to be wrong.
          (writesHalted
            ? `The server has been turning sends down, so ${one ? 'it is' : 'they are'} being held safely here, and your numbers will not include ${one ? 'it' : 'them'} until ${one ? 'it goes' : 'they go'}.`
            : `${one ? 'It sends' : 'They send'} automatically, and your numbers will not include ${one ? 'it' : 'them'} until ${one ? 'it does' : 'they do'}.`),
        short: `${queuedWrites.length} ${one ? 'change' : 'changes'} not sent`,
        spoken: `${queuedWrites.length} ${one ? 'change has' : 'changes have'} not reached the server yet. Open the first call.`,
        onPress: () =>
          router.push({ pathname: '/(app)/[id]', params: { id: queuedWrites[0].sessionId } }),
      });
    }

    if (unscored.length > 0 && !filtering) {
      const one = unscored.length === 1;
      items.push({
        key: 'unscored',
        title: `${unscored.length} ${one ? 'call has' : 'calls have'} no outcome`,
        body:
          `${one ? 'It is' : 'They are'} not counted in your numbers until you say how ${
            one ? 'it' : 'they'
          } ended.` +
          // The count is only as complete as what has been loaded. Saying "4
          // calls" when older ones have not been looked at would be a number the
          // rep could act on and find wrong.
          (hasMore ? ' Older calls are not loaded yet, so there may be more.' : ''),
        short: `${unscored.length} ${one ? 'call has' : 'calls have'} no outcome`,
        spoken: `Show the ${unscored.length} ${one ? 'call' : 'calls'} with no outcome recorded`,
        onPress: () => setOnlyUnscored(true),
      });
    }

    return items;
  }, [needVoice, pendingRecordings, sendingHalted, writesHalted, queuedWrites, unscored, filtering, hasMore, router]);
  const sections = useMemo(() => groupByDay(visible, query), [visible, query]);
  const matchCount = useMemo(
    () => sections.reduce((n, s) => n + s.data.length, 0),
    [sections],
  );

  // Nothing to paint yet: no cache, no answer. This is the only spinner.
  if (sessions === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['top', 'bottom']}>
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading your calls" />
      </SafeAreaView>
    );
  }

  const searchable = all.length >= SEARCH_THRESHOLD;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(s) => s.id}
        contentContainerClassName="grow px-5 pb-6"
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={C['muted-foreground']}
          />
        }
        ListHeaderComponent={
          <View>
            <Attention items={attention} />

            <Notice
              error={error}
              cachedAt={cachedAt}
              offline={offline}
              hasRows={all.length > 0}
            />
            {filtering ? (
              <Pressable
                onPress={() => setOnlyUnscored(false)}
                accessibilityRole="button"
                accessibilityLabel="Show all calls"
                className="mt-4 min-h-7 justify-center rounded-md border border-primary px-3 py-3 active:opacity-70"
              >
                <Text className="font-strong text-base text-foreground">
                  Showing only calls with no outcome
                </Text>
                <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                  {unscored.length} of {all.length}. Tap to show all calls again.
                </Text>
              </Pressable>
            ) : null}

            {searchable ? (
              <SearchField
                value={query}
                onChangeText={setQuery}
                label="Find a call"
                accessibilityLabel="Find a call by name, outcome, or where, how and what"
                placeholder="Name, outcome, or a detail"
                noun="session"
                resultCount={query.trim() ? matchCount : null}
              />
            ) : null}

            {/* A search that has only seen part of the history and says "no
                match" is telling the rep something untrue about their own
                calls. It says what it actually searched instead. */}
            {query.trim() && hasMore ? (
              <Pressable
                onPress={loadMore}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Load older calls and search those too"
                accessibilityState={{ disabled: loadingMore }}
                className="mt-2 min-h-7 justify-center active:opacity-70"
              >
                <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                  Searching your {all.length} most recent calls. Older ones are not loaded yet —
                  tap to include them.
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            error={error}
            query={query.trim()}
            onRetry={refresh}
            onClear={() => setQuery('')}
            onRecord={() => router.push('/(app)/record')}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          hasMore ? (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              accessibilityRole="button"
              accessibilityLabel="Load older calls"
              accessibilityState={{ disabled: loadingMore, busy: loadingMore }}
              className="mt-4 min-h-7 flex-row items-center justify-center gap-2 rounded-md border border-border-control px-5 py-3 active:opacity-70"
            >
              {loadingMore ? <ActivityIndicator color={C['muted-foreground']} /> : null}
              <Text className="font-emphasis text-base text-foreground">
                {loadingMore ? 'Loading older calls' : 'Load older calls'}
              </Text>
            </Pressable>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <View className="bg-background pb-2 pt-5">
            <Text
              accessibilityRole="header"
              className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
            >
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <SessionRow
            session={item}
            queued={queuedBySession.get(item.id)}
            viewerId={userId}
            repNames={repNames}
          />
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
      />

      {/* ONE primary action, and only one.
          
          SEEN ON A REAL DEVICE, which is the only way this was ever going to be
          caught: three stacked full-width buttons took roughly a third of the
          screen, and the list — the thing a rep opens this app to read — got
          what was left. The comment that used to sit here said "one primary
          action… five emphasised things means none are" while rendering three
          of near-identical weight. It described the rule and broke it.

          Recording is the primary: it is what fills this list, and it is the one
          thing a rep does here that cannot be done later from a desk. The coach
          and the numbers are DESTINATIONS — they are still labelled words, never
          bare icons, which is what the design law actually requires of a menu —
          but they no longer compete with the content or with each other. */}
      <View className="gap-3 border-t border-border px-5 pb-2 pt-3">
        <Pressable
          onPress={() => router.push('/(app)/record')}
          accessibilityRole="button"
          accessibilityLabel="Record a call"
          className="min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
        >
          <Text className="font-strong text-base text-primary-foreground">Record a call</Text>
        </Pressable>

        {/* Side by side, because they are peers: two places to go, neither more
            important than the other, and together they cost one row instead of
            two. Stacked at large text sizes, where a row of two would squeeze
            each label into fragments. */}
        <View className={stacked ? 'gap-3' : 'flex-row gap-3'}>
          <Pressable
            onPress={() => router.push('/(app)/coach')}
            accessibilityRole="button"
            accessibilityLabel="Ask the coach"
            className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control px-4 py-3 active:bg-surface"
          >
            <Text className="font-emphasis text-base text-foreground">Ask the coach</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(app)/(tabs)/kpi')}
            accessibilityRole="button"
            accessibilityLabel="Your numbers"
            className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control px-4 py-3 active:bg-surface"
          >
            <Text className="font-emphasis text-base text-foreground">Your numbers</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel={
            user?.email ? `Sign out of ${user.email}` : 'Sign out'
          }
          className="min-h-7 flex-row items-baseline justify-between gap-3 active:opacity-70"
        >
          <Text className="font-emphasis text-sm text-muted-foreground">Sign out</Text>
          {user?.email ? (
            <Text
              numberOfLines={1}
              className="shrink font-body text-xs text-muted-foreground"
            >
              {user.email}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────── pieces */

/**
 * The one place the screen admits what it is showing. Either these rows came
 * from the network just now (no notice at all), or they are cached and say so
 * with the time, or the refresh failed and says that too.
 */
function Notice({
  error,
  cachedAt,
  offline,
  hasRows,
}: {
  error: string | null;
  cachedAt: Date | null;
  offline: boolean;
  hasRows: boolean;
}) {
  if (!hasRows) return null;

  // Offline outranks the network error it caused. "Could not reach your
  // sessions" is technically true and useless; "you are offline, this is what
  // you last saw" tells the rep what is happening and that nothing is lost.
  if (offline) {
    return (
      <View
        accessibilityLiveRegion="polite"
        className="mt-4 rounded-md border border-border-control px-3 py-2"
      >
        <Text className="font-body text-sm leading-relaxed text-muted-foreground">
          You are offline. This is what you last saw
          {cachedAt ? `, from ${shortDate(cachedAt.toISOString())} at ${clockTime(cachedAt.toISOString())}` : ''}.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="mt-4 rounded-md border border-destructive px-3 py-3"
      >
        <Text className="font-body text-sm leading-relaxed text-destructive">
          Showing what you last saw. {error}
        </Text>
      </View>
    );
  }

  if (cachedAt) {
    return (
      <View className="mt-4 rounded-md border border-border-control px-3 py-2">
        <Text className="font-body text-sm text-muted-foreground">
          Last updated {shortDate(cachedAt.toISOString())} at {clockTime(cachedAt.toISOString())} ·
          checking for newer
        </Text>
      </View>
    );
  }

  return null;
}

/**
 * One call in the list.
 *
 * `queued` is the instruction for THIS call that is still on the phone, if there
 * is one. The row shows the rep's own answer rather than the server's blank,
 * marked as not yet sent — because a rep scanning for "the one I haven't scored"
 * would otherwise find a call they scored an hour ago and score it again. Marked
 * rather than shown plainly, because the manager cannot see it yet and the rep
 * needs to know which of those two worlds they are looking at.
 */
function SessionRow({
  session,
  queued,
  viewerId,
  repNames,
}: {
  session: SessionListRow;
  queued?: OutboxEntry;
  /** Who is reading. A row that is not theirs gets its owner's name. */
  viewerId: string | null;
  repNames: ReadonlyMap<string, string>;
}) {
  const router = useRouter();
  const stacked = useLargeText();
  const at = clockTime(session.started_at);
  const length = duration(session.audio_duration_seconds);
  const pendingOutcome = queued?.kind === 'outcome' ? queued : undefined;
  const value = money(pendingOutcome?.dealValue ?? session.deal_value);
  const settled = pendingOutcome?.outcome ?? session.outcome;
  const hasOutcome = Boolean(settled);
  const outcome = outcomeLabel(settled);
  const pendingName = queued?.kind === 'rename' ? queued.clientLabel?.trim() : undefined;
  const title = pendingName || session.client_label?.trim() || 'Untitled session';

  /**
   * Whether the coach has come back on this one.
   *
   * The question a rep asks every morning, which this row could not answer —
   * four calls recorded yesterday looked identical whether the coaching had
   * arrived or not. Renders NOTHING when the count could not be read: see
   * lib/session-analysis.ts for why "unknown" is its own state and not a
   * hopeful "being analysed".
   */
  const analysis = analysisState(
    Boolean(session.audio_asset_url),
    session.segmentCount,
    session.created_at,
  );
  const analysisText = analysisChip(analysis);
  // A one-sided recording is a CAPTURE problem the rep can fix, and it reads
  // differently from "still being analysed" — which is why it gets its own line
  // rather than being folded into the analysis chip.
  const oneSided = session.readIssue === 'one-sided';
  /*
    THE COACH STOPPED, and the rep is not to blame for it.

    Measured on production 10 September 2026: more than half of all coaching runs produce
    nothing, and the ones that fail are the LONGER calls - median 683 transcript words
    against 341 for the ones that succeed. Thin content would be SHORT, so for most of these
    the rep did everything right and was shown NOTHING AT ALL: no read, no chip, no reason.

    Only the shapes that mean the COACH failed reach here. A call the coach genuinely read
    and found little in stays silent, exactly as before - offering a retry there would send a
    rep back to a call that has nothing more to give.
  */
  const unfinished = session.readIssue === 'unfinished';
  /*
    WAITING ON THE REP, and the only place they would ever find out.

    A call recovered from dropped audio keeps its words as `unknown` when the system
    could not tell which voice is the rep. Every coaching engine reads `agent` turns, so
    until somebody answers, that call is stored and scores nothing. The session screen
    asks the question - but a rep does not reopen a call that showed them nothing months
    ago, so without this line the question is never seen and the words stay unusable.
  */
  const voiceQuestion = voiceQuestionWording(
    { segments: session.segmentCount, unattributed: session.unattributedCount },
    // Whose call this is, not what role the reader holds: a manager looking at their OWN
    // call is a rep looking at their own work and gets the words that ask them to act.
    session.agent_id === viewerId,
  );
  // Null for a rep's own calls, so their list is unchanged. A manager's list
  // gets the one fact it was missing: whose call this is.
  const owner = ownerLabel(session.agent_id, viewerId, repNames);

  // The whole row is one control with one accessible name that reads as a
  // sentence — not four separate stops for a screen-reader user to reassemble.
  // The "not sent yet" is spoken too: a sighted rep gets it from the chip, and
  // leaving it out of the label would make that the one fact only they receive.
  const spoken = [
    title,
    at,
    outcome,
    ownerSpoken(owner),
    queued ? 'not sent yet' : '',
    oneSided ? ONE_SIDED_SPOKEN : '',
    unfinished ? UNFINISHED_SPOKEN : '',
    voiceQuestion?.spoken ?? '',
    analysisSpoken(analysis),
    length,
    value,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(app)/[id]', params: { id: session.id } })}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      // At large text sizes the name and the outcome chip stop fitting beside
      // each other, and squeezing them turns a customer's name into three
      // fragments. Stacked, the row is taller and every word is whole — which is
      // the trade a reader who has turned their text up has already chosen.
      className={`min-h-7 gap-3 py-4 active:bg-surface ${
        stacked ? '' : 'flex-row items-center'
      }`}
    >
      <View className="flex-1">
        {/* Two lines at an accessibility text size. The title has the row to itself, so it only truncates when a
            long name meets a large size — but "Door on 4 September, Elm Street" is an ordinary name, not a long
            one. `stacked` was already read in this row for the layout below; the cap had simply been missed. */}
        <Text numberOfLines={stacked ? 2 : 1} className="font-strong text-base text-foreground">
          {title}
        </Text>
        {/* The day is the section header, so the row carries the time within it. */}
        <Text className="mt-1 font-body text-sm text-muted-foreground">
          {[at, length].filter(Boolean).join(' · ')}
        </Text>
        {/*
          ON THE SECOND LINE, NOT AS A CHIP BESIDE THE OUTCOME.

          It belongs with the time and the length — facts about the recording —
          rather than in the column that answers "how did the call go". And it
          is deliberately quiet: this is a reassurance, not a warning. Nothing
          has gone wrong with a call that is still being analysed.

          Absent for a finished call, absent for a call with no audio, and
          absent when the count could not be read. The only thing that draws it
          is a real, checked "not yet".
        */}
        {/* Drawn in the accent, not the muted grey the analysis line uses: this one
            asks the rep to DO something (re-record, or set which voice is theirs),
            where "Being analysed" only asks them to wait. */}
        {/* Whose call this is, shown ONLY when it is not the reader's own — see
            session-owner.ts for why this is not a role check. Muted and under the
            customer's name: it identifies the row, it is not the headline. */}
        {owner ? (
          <Text numberOfLines={1} className="mt-0.5 font-body text-sm text-muted-foreground">
            {owner}
          </Text>
        ) : null}
        {oneSided ? (
          <Text className="mt-1 font-emphasis text-sm text-primary">{ONE_SIDED_CHIP}</Text>
        ) : null}
        {/* Same accent, same reason as the other two: this one asks the rep to DO something
            (open it and rebuild), where the muted analysis line only asks them to wait. */}
        {unfinished ? (
          <Text className="mt-1 font-emphasis text-sm text-primary">{UNFINISHED_CHIP}</Text>
        ) : null}
        {/* Same accent as the one-sided chip and for the same reason: both ask the rep
            to DO something, where the muted analysis line only asks them to wait. */}
        {voiceQuestion ? (
          <Text className="mt-1 font-emphasis text-sm text-primary">{voiceQuestion.chip}</Text>
        ) : null}
        {analysisText ? (
          <Text className="mt-1 font-body text-sm text-muted-foreground">{analysisText}</Text>
        ) : null}
      </View>

      <View className={stacked ? 'items-start gap-1' : 'items-end gap-1'}>
        {/* THE CHIP IS ONLY DRAWN WHEN THERE IS AN OUTCOME.
        
            Seen on a real device: a rep with 49 unscored calls got an identical
            "Not recorded" chip on every single row. A label repeated on every
            row of a list carries no information — it is weight without signal,
            and it made the one thing that DOES vary (a real outcome, a deal
            value) harder to pick out.
        
            Absence now reads as absence, which is the honest rendering of a
            fact that has not been recorded. Nothing is lost: the row's
            accessible label still speaks "Not recorded", and the count of them
            is stated at the top of the screen where it can be acted on.
        
            Never colour alone: the word carries it, here and on "Not sent". */}
        {hasOutcome ? (
          <View className="rounded-md border border-border-control px-2 py-1">
            <Text className="font-emphasis text-xs text-muted-foreground">{outcome}</Text>
          </View>
        ) : null}
        {queued ? (
          <Text className="font-emphasis text-xs text-muted-foreground">Not sent</Text>
        ) : null}
        {value ? <Text className="font-strong text-sm text-primary">{value}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Three different empties, because they mean three different things: the search
 * found nothing, the load failed, or the rep genuinely has no sessions. Collapsing
 * them into one message is how a user ends up retrying the wrong thing.
 */
function EmptyState({
  error,
  query,
  onRetry,
  onClear,
  onRecord,
}: {
  error: string | null;
  query: string;
  onRetry: () => void;
  onClear: () => void;
  onRecord: () => void;
}) {
  if (query) {
    return (
      <View className="grow items-start justify-center gap-3">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          Nothing matches “{query}”
        </Text>
        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          Search looks at the session name and the outcome.
        </Text>
        <Pressable
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
          className="mt-2 min-h-7 justify-center rounded-md border border-border-control px-5 active:opacity-70"
        >
          <Text className="font-emphasis text-base text-foreground">Show all calls</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View className="grow items-start justify-center gap-3">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          Could not load your sessions
        </Text>
        <Text className="font-body text-base leading-relaxed text-muted-foreground">{error}</Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
        >
          <Text className="font-strong text-base text-primary-foreground">Try again</Text>
        </Pressable>
      </View>
    );
  }

  /**
   * The first screen a new rep ever sees, and it used to be a dead end.
   *
   * It said what appears here and then stopped — no action, on the one screen
   * where the reader has nothing else to go on. The copy rule names this
   * exactly: an empty state is the best teaching moment in the product, so it
   * has to say what belongs here, why it is worth having, and give the action.
   * The search and error branches above both offer a control; the one that
   * matters most offered none.
   *
   * THE COPY ALSO PROMISED SOMETHING THE APP DOES NOT DELIVER. It said sessions
   * appear "with the transcript and every cue the coach gave you". Cues come
   * from live coaching in the browser; a call recorded on this phone gets a
   * transcript and no cues at all. A first-run screen is the worst place to make
   * a promise the product will not keep — the rep has nothing yet to judge it
   * against, so they simply believe it and then find it untrue.
   */
  return (
    <View className="grow items-start justify-center gap-3">
      <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
        No calls yet
      </Text>
      <Text className="font-body text-base leading-relaxed text-muted-foreground">
        Record a call and it appears here with its transcript, so you can read back what
        was actually said and set how it ended. That is what your numbers are built from.
      </Text>
      <Pressable
        onPress={onRecord}
        accessibilityRole="button"
        accessibilityLabel="Record a call"
        className="mt-2 min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
      >
        <Text className="font-strong text-base text-primary-foreground">Record a call</Text>
      </Pressable>
      <Text className="font-body text-sm leading-relaxed text-muted-foreground">
        Calls you take on the website appear here too.
      </Text>
    </View>
  );
}
