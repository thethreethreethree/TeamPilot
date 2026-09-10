/**
 * Your numbers — the KPI board, Phase 3 of the build plan.
 *
 * EVERY NUMBER ON THIS SCREEN IS FETCHED, NEVER COMPUTED. The server owns the
 * KPI maths and this screen renders its verdict. the integration architecture's rule — consume the
 * verdict, do not re-derive it — makes a second copy of the formula a drift defect, and it is
 * right: the server's compute already carries a duration-outlier fix that a
 * device copy would silently lack, and the web and the app would then show the
 * same rep two different close rates.
 *
 * THE SHIM LANDED. This used to say the screen would get a 401 "until the
 * Phase-2 Bearer shim is deployed", and that has not been true for some time:
 * on 4 September `/api/coach/kpi/me?scope=day` answered 200 with real metrics
 * for this account, using the app's own Bearer token.
 *
 * The refusal branch is kept because a 401 can still happen for real reasons,
 * and it must never hide behind "try again" — a rep can retry a refusal forever
 * and it will not help. What it must NOT do is name a deploy that has already
 * happened; `blocked-state.ts` carries the wording that says so honestly.
 *
 * A11 GOVERNS THE TONE. This board mirrors; it does not judge. Numbers are
 * stated with their movement and nothing else — no targets a rep did not set, no
 * colour coding a fall as failure, no encouragement. A rep who feels graded by a
 * dashboard stops trusting it, and an untrusted dashboard is worse than none.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { coachGet } from '@/lib/coach-api';
import { openingScope } from '@/lib/kpi-scope';
import { readMyProfile } from '@/lib/profile';
import { buildKpiView, type KpiView, type MetricRow } from '@/lib/kpi-view';
import { outcomeLabel , clockTime, shortDate } from '@/lib/format';
import type { SessionOutcome , KpiResponse } from '@/types/backend';
import { useOnline, isOffline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { useAuth } from '@/lib/auth-context';
import { readCachedKpi, writeCachedKpi } from '@/lib/sync/kpi-cache';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { blockedState } from '@/lib/blocked-state';
import { useLargeText } from '@/lib/use-large-text';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', 'your numbers');

type State =
  | { phase: 'loading' }
  /** `cachedAt` is set only when these numbers came off the device. The board
   *  must say so — a conversion rate from this morning presented as current is
   *  the kind of quiet lie the cache rules exist to prevent. */
  | { phase: 'ready'; view: KpiView; cachedAt: Date | null }
  | { phase: 'needs-shim' }
  | { phase: 'error'; message: string };

export default function KpiScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: 'loading' });
  /**
   * Which figures are being asked for.
   *
   * The route accepts scope=company for a company admin and QUIETLY FALLS BACK
   * to self for anyone else — so asking is also how the app finds out whether
   * this rep has company access. It does not ask on load: a rep who is not an
   * admin would pay for a request whose only purpose is to be refused.
   */
  const [scope, setScope] = useState<'self' | 'company'>('self');
  /**
   * A manager is moved to the company figures ONCE, on first load.
   *
   * Mirrors the website, which does this because a per-rep view stays mostly
   * "building" while the pooled business numbers are real today. Once only, and
   * never again — a manager who deliberately switches to Mine must not be
   * yanked back out of it by a refresh, which is the same guard the website
   * uses. The role comes from the cached profile, so this costs no request.
   */
  const openingApplied = useRef(false);
  /** Set when a company request came back as self — this account cannot see it. */
  const [companyRefused, setCompanyRefused] = useState(false);
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const online = useOnline();
  const offline = isOffline(online);

  useEffect(() => {
    if (openingApplied.current || !userId) return;
    openingApplied.current = true;
    let cancelled = false;
    void (async () => {
      const profile = await readMyProfile(userId);
      if (cancelled) return;
      const opening = openingScope(profile.companyRole);
      if (opening === 'company') setScope('company');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const load = useCallback(async () => {
    try {
      const res = await coachGet<KpiResponse>(`/api/coach/kpi/me?scope=${scope}`);

      // The server answers with the scope it ACTUALLY applied. Asking for the
      // company view and receiving your own is not an error — it is the route
      // saying this account is not a company admin. Rendering it as the company
      // view would show a manager their own dozen calls and call it the team.
      const granted = res.scope === 'company' ? 'company' : 'self';
      if (scope === 'company' && granted === 'self') {
        setCompanyRefused(true);
        setScope('self');
      }

      setState({ phase: 'ready', view: buildKpiView(res), cachedAt: null });
      if (userId) writeCachedKpi(userId, granted, res);
    } catch (e) {
      // Numbers the rep has already seen beat an error screen, as long as they
      // are labelled with when they were true.
      const cached = userId ? await readCachedKpi(userId, scope) : null;
      if (cached) {
        setState({ phase: 'ready', view: buildKpiView(cached.res), cachedAt: cached.at });
        return;
      }
      const status = (e as { status?: number })?.status;
      // A 401 IS NOT ALWAYS A LOGIN PROBLEM, and the two must be told apart:
      // for a revoked or expired session, signing in is the ONLY thing that
      // helps; for anything else it sends the rep round a loop that cannot end.
      // `coach-api` distinguishes them (2.2) and this branches on the answer.
      //
      // WHAT CHANGED (4 September). This used to explain the non-login case as
      // "the route cannot read a mobile token yet". Every coach route this app
      // calls now resolves a mobile Bearer token — swept and confirmed against
      // the web repository — so a refusal is no longer evidence of a missing
      // shim. It means the server turned down a LIVE token for a reason this
      // app cannot see, and `blockedState('route', …)` says that and no more.
      // Three screens were found still promising a deploy that had shipped.
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
        message: reachError(e, online, 'your numbers'),
      });
    }
  }, [userId, scope, online]);

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
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
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
              These numbers are worked out on the server, so they need signal. Pull
              down to try again once you have a bar.
            </Text>
          </View>
        ) : null}

        {state.phase === 'loading' ? (
          <View className="mt-16 items-center">
            <ActivityIndicator color={C.primary} accessibilityLabel="Loading your numbers" />
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
            <Text className="mt-3 font-body text-base leading-relaxed text-muted-foreground">
              Everything else in the app works as normal in the meantime.
            </Text>
          </View>
        ) : null}

        {state.phase === 'error' ? (
          <View className="mt-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Could not load your numbers
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {state.message}
            </Text>
            <Pressable
              onPress={load}
              accessibilityRole="button"
              accessibilityLabel="Try again"
              className="mt-4 min-h-7 items-center justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
            >
              <Text className="font-strong text-base text-primary-foreground">Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {companyRefused ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-4 rounded-md border border-border-control px-3 py-3"
          >
            <Text className="font-strong text-base text-foreground">
              These are your own numbers
            </Text>
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              Your account does not have access to the company view, so the figures
              below are yours alone. Nothing is wrong — that is how it is set up.
            </Text>
          </View>
        ) : null}

        {state.phase === 'ready' ? (
          <>
            <Board
              view={state.view}
              cachedAt={state.cachedAt}
              onOpenUnscored={() => router.push('/(app)/(tabs)/sessions')}
              onOpenSession={(id) => router.push({ pathname: '/(app)/[id]', params: { id } })}
            />

            {/* WHY THESE MOVED BELOW THE NUMBERS.
                They used to sit above them — three bordered boxes identical in
                weight to the alerts around them, so a rep opening "your numbers"
                read four rectangles of chrome before reaching a single figure.
                Every one of them is a question you ask AFTER reading a number:
                is this the company or me, is it moving, how is the team. So they
                belong after it, and they belong quieter than it: the board is the
                content of this screen and these are the ways out of it. */}
            <View className="mt-8 border-t border-border pt-6">
              <Text
                accessibilityRole="header"
                className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
              >
                Look closer
              </Text>

              {!companyRefused ? (
                <Pressable
                  onPress={() => setScope(scope === 'self' ? 'company' : 'self')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: scope === 'company' }}
                  accessibilityLabel={
                    scope === 'self'
                      ? 'Show the whole company instead of only you'
                      : 'Show only your own calls'
                  }
                  className="mt-3 min-h-7 justify-center active:opacity-70"
                >
                  <Text className="font-emphasis text-base text-primary">
                    {scope === 'self' ? 'Show the whole company' : 'Show only my calls'}
                  </Text>
                </Pressable>
              ) : null}

              {/* Offered here rather than fetched here: the months are a second
                  request and most visits to this screen do not want them. */}
              <Pressable
                onPress={() => router.push('/(app)/trend')}
                accessibilityRole="button"
                accessibilityLabel="See how these numbers are moving month by month"
                className="mt-3 min-h-7 justify-center active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">
                  See how these are moving
                </Text>
              </Pressable>

              {/* Offered to everyone rather than hidden behind a guess about who
                  is a manager: the server decides, and the screen says plainly if
                  the answer is no. Guessing wrong the other way would hide the
                  feature from the managers it exists for. */}
              <Pressable
                onPress={() => router.push('/(app)/team')}
                accessibilityRole="button"
                accessibilityLabel="See your team's figures, if you manage one"
                className="mt-3 min-h-7 justify-center active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">See your team</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Board({
  view,
  cachedAt,
  onOpenUnscored,
  onOpenSession,
}: {
  view: KpiView;
  cachedAt: Date | null;
  onOpenUnscored: () => void;
  onOpenSession: (id: string) => void;
}) {
  return (
    <View>
      {/* Said before the numbers, not after: a rep who reads a figure and only
          then learns it is from yesterday has already acted on it. */}
      {cachedAt ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mt-4 rounded-md border border-border-control px-3 py-3"
        >
          <Text className="font-strong text-base text-foreground">Saved figures</Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            As of {shortDate(cachedAt.toISOString())} at {clockTime(cachedAt.toISOString())}. Calls
            made since are not counted here yet. Pull down when you have signal.
          </Text>
        </View>
      ) : null}
      {/* The Understanding Gate, said out loud. A board of "building" with no
          explanation reads as broken; with the count it reads as a countdown. */}
      {view.building ? (
        <View className="mt-4 rounded-md border border-border-control px-3 py-3">
          <Text className="font-strong text-base text-foreground">Still building</Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {view.sessionCount === 0
              ? `Your numbers appear once you have ${view.minSessions} recorded calls.`
              : `${view.sessionCount} of ${view.minSessions} calls so far. Numbers appear once there are enough to mean something.`}
          </Text>
        </View>
      ) : (
        <Text className="mt-4 font-body text-sm text-muted-foreground">
          From {view.sessionCount} {view.sessionCount === 1 ? 'call' : 'calls'}
          {view.scope === 'company' ? ', across the company' : ''}.
        </Text>
      )}

      {/* The explanation for a board that will not fill in. Said here, next to
          the numbers it affects, rather than left for the rep to work out. */}
      {view.unscoredCount > 0 ? (
        <Pressable
          onPress={onOpenUnscored}
          accessibilityRole="button"
          accessibilityLabel={`${view.unscoredCount} ${
            view.unscoredCount === 1 ? 'call is' : 'calls are'
          } missing an outcome. Open your sessions to set ${
            view.unscoredCount === 1 ? 'it' : 'them'
          }.`}
          className="mt-5 min-h-7 justify-center rounded-md border border-border-control px-3 py-3 active:opacity-70"
        >
          <Text className="font-strong text-base text-foreground">
            {view.unscoredCount} {view.unscoredCount === 1 ? 'call has' : 'calls have'} no outcome
          </Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {view.unscoredCount === 1 ? 'It counts' : 'They count'} toward nothing here until you
            say how {view.unscoredCount === 1 ? 'it' : 'they'} ended. Tap to open your sessions.
          </Text>
        </Pressable>
      ) : null}

      {/* Said once, above the numbers, when they are not only this rep's. The
          response carries no owner name for a session, so a manager opening one
          from the list below genuinely cannot tell whose call it is — better to
          say that than to let them assume it is their own. */}
      {view.scope === 'company' ? (
        <Text className="mt-5 font-body text-sm leading-relaxed text-muted-foreground">
          These cover everyone in the company. Calls listed under a number may
          belong to any rep — the app is not told whose is whose.
        </Text>
      ) : null}

      <Group
        title={view.scope === 'company' ? 'The company' : 'Your numbers'}
        rows={view.headline}
        scale="display"
        onOpenSession={onOpenSession}
      />
      {view.rest.length > 0 ? (
        <Group title="How the calls went" rows={view.rest} onOpenSession={onOpenSession} />
      ) : null}

      <Text className="mt-8 font-body text-xs leading-relaxed text-muted-foreground">
        These are the same figures the website shows, worked out in the same place —
        the app never recalculates them. Comparisons are against your own earlier
        calls, not against anyone else.
      </Text>
    </View>
  );
}

function Group({
  title,
  rows,
  scale,
  onOpenSession,
}: {
  title: string;
  rows: MetricRow[];
  scale?: 'display' | 'reading';
  onOpenSession: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <View className="mt-7">
      <Text
        accessibilityRole="header"
        className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
      >
        {title}
      </Text>
      <View className="mt-2">
        {rows.map((row) => (
          <Metric key={row.key} row={row} scale={scale} onOpenSession={onOpenSession} />
        ))}
      </View>
    </View>
  );
}

/**
 * One figure.
 *
 * `scale` is the design pass's central decision on this screen. Every metric used
 * to render at the same size, which meant the screen had no answer to the only
 * question a rep opens it with — "how am I doing?". Six identical bordered boxes
 * and eight identical numbers is a screen where nothing is emphasised, and the
 * design law says exactly why: distinctiveness is relational, so five emphasised
 * elements means none are.
 *
 * The headline figures — the two or three a rep actually came for — are set at
 * display scale. Everything else stays at reading scale. That is the whole
 * hierarchy, and it costs one prop rather than a second component that would
 * drift.
 */
function Metric({
  row,
  scale = 'reading',
  onOpenSession,
}: {
  row: MetricRow;
  scale?: 'display' | 'reading';
  onOpenSession: (id: string) => void;
}) {
  const [showSources, setShowSources] = useState(false);
  // Subscribed, so a rep who changes their text size and comes back finds the call names already given room.
  const stacked = useLargeText();
  // One accessible sentence per metric, so a screen reader does not read a
  // number stranded from its name and its state.
  const spoken = row.gated
    ? `${row.label}: building. ${row.sampleSize} of the calls needed so far.`
    : `${row.label}: ${row.display}.${row.change ? ` ${row.change}.` : ''}`;

  return (
    <View accessible accessibilityLabel={spoken} className="border-b border-border py-4">
      <Text className="font-emphasis text-sm text-muted-foreground">{row.label}</Text>

      {row.gated ? (
        <>
          <Text
            className={`mt-1 font-heading text-muted-foreground ${
              scale === 'display' ? 'text-2xl' : 'text-xl'
            }`}
          >
            Building
          </Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {row.needed && row.needed > 0
              ? `${row.needed} more ${row.needed === 1 ? 'call' : 'calls'} needed. ${row.sampleSize} so far.`
              : `Not enough of the right calls yet. ${row.sampleSize} so far.`}
          </Text>
        </>
      ) : (
        <>
          {/* Tabular figures so a column of numbers lines up as it is scanned. */}
          <Text
            className={`mt-1 font-heading tabular-nums text-foreground ${
              scale === 'display' ? 'text-4xl' : 'text-2xl'
            }`}
            // The number is the content, and at display scale it is also the
            // largest thing on the screen — so it must still grow with the
            // reader's text size rather than being pinned by the layout.
            maxFontSizeMultiplier={2}
          >
            {row.display}
          </Text>
          {row.change ? (
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              {row.change}
            </Text>
          ) : null}

          {/* The evidence. A11 says this board mirrors rather than judges, and
              the strongest form of that is letting a rep check a figure against
              the calls that produced it — a number you can open is evidence, one
              you cannot is something you have to take on trust. */}
          {row.sources.length > 0 ? (
            <Pressable
              onPress={() => setShowSources((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showSources }}
              accessibilityLabel={
                showSources
                  ? `Hide the ${row.sources.length} calls behind ${row.label}`
                  : `Show the ${row.sources.length} calls behind ${row.label}`
              }
              className="mt-2 min-h-7 justify-center active:opacity-70"
            >
              <Text className="font-emphasis text-sm text-primary">
                {showSources
                  ? 'Hide the calls behind this'
                  : `From ${row.sources.length} ${row.sources.length === 1 ? 'call' : 'calls'}`}
              </Text>
            </Pressable>
          ) : null}

          {showSources
            ? row.sources.map((source) => (
                <Pressable
                  key={source.id}
                  onPress={() => onOpenSession(source.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${source.label ?? 'this call'}, ${outcomeLabel(
                    (source.outcome as SessionOutcome | null) ?? null,
                  )}`}
                  className="mt-2 min-h-7 justify-center border-l-2 border-border-control pl-3 active:opacity-70"
                >
                  {/* Two lines at an accessibility text size. The call's name has the row to itself, so it only
                      truncates when a long name meets a large size — and a name like "Door on 4 September, Elm
                      Street" is ordinary, not long. */}
                  <Text
                    numberOfLines={stacked ? 2 : 1}
                    className="font-body text-base text-foreground"
                  >
                    {source.label?.trim() || 'Unnamed call'}
                  </Text>
                  <Text className="font-body text-sm text-muted-foreground">
                    {shortDate(source.startedAt)} ·{' '}
                    {outcomeLabel((source.outcome as SessionOutcome | null) ?? null)}
                  </Text>
                </Pressable>
              ))
            : null}
        </>
      )}
    </View>
  );
}
