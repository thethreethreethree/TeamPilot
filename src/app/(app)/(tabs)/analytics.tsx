/**
 * Analytics — how the rep sells, graded.
 *
 * THE TAB USED TO POINT AT THE KPI BOARD, and that was wrong. Both are
 * "numbers", so the mapping looked right from the tab's name alone. Reading
 * `dashboard/sales-coach/analytics` showed they are different questions: the KPI
 * board is conversion, revenue and close rate — what the calls ADDED UP TO.
 * This is objection handling, questions, tone and listening — HOW they were sold.
 * A rep improves by working on the second and is measured by the first.
 *
 * The KPI board is still one tap away, at the bottom, because a rep who reads a
 * grade usually wants to know what it did to the numbers.
 *
 * THE ONE RULE THAT MATTERS MOST is the server's, quoted in its own source: an
 * unmeasured skill "returns an honest not-yet grade — NOT a low letter". A rep
 * who has never been measured on questions must never see a D for it. So an
 * unscored skill draws no bar, no letter, and says plainly that it has not been
 * measured — and the sample size is shown beside every score, because a B from
 * two calls and a B from forty are not the same claim.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { coachGet } from '@/lib/coach-api';
import { useOnline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { buildSkillsView, type Skill, type SkillRow } from '@/lib/skills-view';
import {
  NOTHING_GRADED_BODY,
  PHASE_UNMEASURED,
  PROCESS_HEADING,
  nothingGradedYet,
  processRows,
  type PhaseRow,
} from '@/lib/process-breakdown';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { blockedState } from '@/lib/blocked-state';
import { useLargeText } from '@/lib/use-large-text';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', 'your skills');

type Phase = 'loading' | 'ready' | 'needs-shim' | 'error';

export default function AnalyticsScreen() {
  // Read here so the failure notice can name a cause it has actually checked.
  // These screens all said "check your connection" for every failure, 5xx
  // included — reported 4 September from a phone with full bars.
  const online = useOnline();

  const router = useRouter();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [sampleSessions, setSampleSessions] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  /** The four sale phases. Always four rows, even when the server sent fewer. */
  const [phases, setPhases] = useState<PhaseRow[]>(() => processRows([]));
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // `processBreakdown` was already in this response and already being
      // discarded — the server grades the four phases and sent them; the screen
      // read two of the three fields. Typed `unknown` because processRows does
      // the reading, including the phases the server omits entirely.
      const data = await coachGet<{
        skills: Skill[];
        sampleSessions: number;
        processBreakdown?: unknown;
      }>('/api/coach/sales-session/skills');
      setSkills(data.skills ?? []);
      setSampleSessions(data.sampleSessions ?? 0);
      setPhases(processRows(data.processBreakdown));
      setPhase('ready');
    } catch (e) {
      const status = (e as { status?: number })?.status;
      // 2.2: consume coach-api's verdict rather than re-deriving it. A 401 that
      // survived its refresh can mean the rep is SIGNED OUT, and telling them to
      // wait for a deploy would leave them waiting for something that cannot
      // help. coach-api decides once; this branches on the answer.
      const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
      if (why === 'signed-out') {
        setMessage(authFailureMessage('signed-out'));
        setPhase('error');
        return;
      }
      if (status === 401 || status === 403 || status === 404) {
        setPhase('needs-shim');
        return;
      }
      setMessage(reachError(e, online, 'your analytics'));
      setPhase('error');
    }
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const view = buildSkillsView({ skills, sampleSessions });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="grow px-5 pb-10 pt-4"
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
        {phase === 'loading' ? (
          <View className="mt-16 items-center">
            <ActivityIndicator color={C.primary} accessibilityLabel="Loading your skills" />
          </View>
        ) : null}

        {phase === 'needs-shim' ? (
          <View className="mt-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              {BLOCKED.title}
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {BLOCKED.body}
            </Text>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View
            // The load failed and this replaced the screen. A sighted rep sees
            // the swap; without this a screen-reader user is told nothing at all.
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-6"
          >
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Could not load your skills
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {message}
            </Text>
          </View>
        ) : null}

        {phase === 'ready' && view.nothingMeasured ? (
          <View className="grow items-start justify-center gap-3">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Nothing measured yet
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              These grades come from your own recorded calls once they have been analysed. Until
              then there is nothing to show — and a grade drawn from no calls would tell you
              nothing true about how you sell.
            </Text>
            {/* The action, not only the explanation — copy.md. A rep who reads
                what would fill this screen and is given no way to start filling
                it has been taught something and offered nothing. */}
            <Pressable
              onPress={() => router.push('/(app)/record')}
              accessibilityRole="button"
              accessibilityLabel="Record a call"
              className="min-h-7 justify-center rounded-md border border-primary px-4 py-3 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">Record a call</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === 'ready' && !view.nothingMeasured ? (
          <>
            <Text className="font-body text-sm leading-relaxed text-muted-foreground">
              From your last {view.sampleSessions}{' '}
              {view.sampleSessions === 1 ? 'call' : 'calls'}. A grade with few calls behind it is
              a first impression, not a verdict.
            </Text>

            <View className="mt-5 gap-5">
              {view.rows.map((row) => (
                <SkillCard key={row.key} row={row} />
              ))}
            </View>

            {/* The four phases of the sale, directly under the six skills — the
                skills say WHAT is strong, this says WHERE in the call it happens,
                which is the question a rep asks next. */}
            <View className="mt-8 border-t border-border pt-6">
              <Text
                accessibilityRole="header"
                className="font-emphasis text-xs uppercase tracking-widest text-primary"
              >
                {PROCESS_HEADING}
              </Text>

              {nothingGradedYet(phases) ? (
                <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
                  {NOTHING_GRADED_BODY}
                </Text>
              ) : (
                <View className="mt-4 gap-5">
                  {phases.map((row) => (
                    <PhaseRowView key={row.key} row={row} />
                  ))}
                </View>
              )}
            </View>

            {/* Where a rep goes after reading a grade: what it did to the
                numbers. Quiet, because this screen is the content. */}
            <Pressable
              onPress={() => router.push('/(app)/(tabs)/kpi')}
              accessibilityRole="button"
              accessibilityLabel="See what these calls added up to"
              className="mt-8 min-h-7 justify-center border-t border-border pt-6 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">
                What the calls added up to
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One phase of the sale.
 *
 * STACKED, NEVER A JUSTIFIED ROW. A phase label and a score on one justified line
 * is the shape that pushed figures off the screen at large text sizes elsewhere
 * in this app: the label grows and the number leaves. Nothing here shares a line
 * with anything that can grow.
 *
 * NO BAR FOR AN UNMEASURED PHASE. An empty track at zero width reads as a score
 * of nothing, which is the one thing this must never say — the phase has not been
 * graded, and that is a different fact from a bad grade.
 */
function PhaseRowView({ row }: { row: PhaseRow }) {
  return (
    <View accessible accessibilityLabel={row.spoken}>
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="flex-1 font-strong text-base text-foreground">{row.label}</Text>
        {row.avg === null ? (
          <Text className="font-body text-sm text-muted-foreground">{PHASE_UNMEASURED}</Text>
        ) : (
          <Text className="font-heading text-lg tabular-nums text-primary">
            {row.avg}
            <Text className="font-body text-sm text-muted-foreground">/10</Text>
          </Text>
        )}
      </View>

      {row.fraction !== null ? (
        <View className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
          <View
            className="h-1 rounded-full bg-primary"
            style={{ width: `${Math.round(row.fraction * 100)}%` }}
          />
        </View>
      ) : null}

      {row.tip ? (
        <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          {row.tip}
        </Text>
      ) : null}
    </View>
  );
}

function SkillCard({ row }: { row: SkillRow }) {
  const unscored = row.score === null;

  const stacked = useLargeText();

  return (
    <View accessible accessibilityLabel={row.spoken}>
      {/* A skill name beside its grade. At an accessibility text size the name
          needs the whole width on its own, so the grade beside it is squeezed
          into a column of fragments. Stacked, the same two facts read down the
          screen instead — nothing hidden, nothing shortened. */}
      <View
        className={
          stacked ? 'gap-0.5' : 'flex-row items-baseline justify-between gap-3'
        }
      >
        <Text className="flex-1 font-strong text-base text-foreground">{row.label}</Text>
        {/* The letter AND the number. A11: the countable basis travels with the
            verdict — a grade you cannot check is something to take on trust. */}
        {unscored ? (
          <Text className="font-emphasis text-sm text-muted-foreground">Not measured</Text>
        ) : (
          <Text className="font-heading text-xl tabular-nums text-primary">
            {row.grade.letter}
            <Text className="font-body text-sm text-muted-foreground">  {row.score}/10</Text>
          </Text>
        )}
      </View>

      {/* No bar at all when unscored. A zero-width bar reads as a zero score,
          which is the exact lie this screen exists to avoid. */}
      {row.fraction !== null ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-surface-raised"
        >
          <View
            className="h-full rounded-sm bg-primary"
            style={{ width: `${row.fraction * 100}%` }}
          />
        </View>
      ) : null}

      <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
        {row.breakdown?.trim() || row.read}
      </Text>

      {!unscored ? (
        <Text className="mt-1 font-body text-xs text-muted-foreground">
          From {row.sampleSize} {row.sampleSize === 1 ? 'call' : 'calls'}
        </Text>
      ) : null}
    </View>
  );
}
