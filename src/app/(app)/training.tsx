/**
 * Training — the rep's own growth areas, drawn from their own calls.
 *
 * Mirrors `dashboard/sales-coach/training`, which reads
 * `/api/coach/sales-session/my-training`. The route's own comment is the design
 * brief: this is "the CALLER's OWN sales-coach training focuses… drawn from
 * their OWN Dissects, plus their door activity — never anyone else's. No manager
 * gate: this is self-data. §3.4: an honest empty state (no dissects yet) rather
 * than a fabricated list."
 *
 * SO THE EMPTY STATE IS THE FEATURE, not an afterthought. A rep with no analysed
 * calls yet must be told that plainly — a screen that invented three generic
 * "growth areas" would be worse than blank, because it would read as a verdict
 * on them personally, drawn from nothing.
 *
 * A11 GOVERNS THE FRAMING. Growth areas are things to work on, strengths are
 * things that are working; neither is a score and nothing here grades the rep.
 * The words are the server's own — this screen does not rewrite them.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { coachGet, coachPost } from '@/lib/coach-api';
import {
  NO_MATERIAL,
  isUnavailable,
  materialUnavailable,
  readCoachingMaterial,
  type CoachingMaterial,
} from '@/lib/coaching-material';
import { useOnline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { C } from '@/lib/theme';
import { authFailureMessage, authFailureOf, type AuthFailure } from '@/lib/auth-failure';
import { blockedState } from '@/lib/blocked-state';

import {
  hasPractice,
  practiceHeadline,
  practiceLines,
  type PracticeSummary,
} from '@/lib/practice-view';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', 'your training');

type Training = {
  dissectCount: number;
  growthAreas: string[];
  strategies: string[];
  strengths: string[];
  /**
   * The rep's own practice trend, which this route already returns and the app
   * was dropping. A training screen that says what to work on and cannot say
   * whether the work is landing is answering half the question.
   */
  practice?: PracticeSummary | null;
  /**
   * The route's own escape hatch.
   *
   * When its read fails it answers `{ degraded: true }` and NOTHING ELSE — no
   * arrays at all. Typing them as required arrays was wrong twice over: the
   * screen crashed on `growthAreas.length`, and had it not crashed it would
   * have rendered "nothing to work on", which is a claim about a rep's coaching
   * built on a failed query.
   */
  degraded?: boolean;
};

type Phase = 'loading' | 'ready' | 'needs-shim' | 'degraded' | 'error';

export default function TrainingScreen() {
  // Read here so the failure notice can name a cause it has actually checked.
  // These screens all said "check your connection" for every failure, 5xx
  // included — reported 4 September from a phone with full bars.
  const online = useOnline();

  const router = useRouter();
  const [data, setData] = useState<Training | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await coachGet<Training>('/api/coach/sales-session/my-training');
      if (res?.degraded) {
        // Answered, but with nothing in it. Not an error and not an empty
        // record — the server could not work it out this time.
        setData(null);
        setPhase('degraded');
        return;
      }
      setData(res);
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
      setMessage(reachError(e, online, 'your training'));
      setPhase('error');
    }
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['bottom']}>
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading your training" />
      </SafeAreaView>
    );
  }

  const nothingYet =
    phase === 'ready' &&
    (data?.dissectCount ?? 0) === 0 &&
    // `?? []` on the FIELD, not only on `data`: a degraded answer omits these
    // entirely, and `data?.growthAreas.length` throws on the missing array.
    ((data?.growthAreas ?? []).length ?? 0) === 0 &&
    ((data?.strengths ?? []).length ?? 0) === 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        contentContainerClassName="grow px-5 pb-10"
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
        {phase === 'degraded' ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-6"
          >
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Could not work these out
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {/* NOT "nothing to work on". The server answered and said it could
                  not compute them — a rep reading an empty list would conclude
                  their coaching had found nothing, which is a very different
                  thing from a query that failed. */}
              The server answered but could not work out your focuses this time. That is not
              the same as having none — pull down to try again.
            </Text>
          </View>
        ) : phase === 'needs-shim' ? (
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
              Could not load your training
            </Text>
            <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {message}
            </Text>
          </View>
        ) : null}

        {nothingYet ? (
          <View className="grow items-start justify-center gap-3">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Nothing to work on yet
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              This fills in once a few of your calls have been analysed. It comes from your own
              conversations — not from a generic list — so it is worth waiting for.
            </Text>
          </View>
        ) : null}

        {phase === 'ready' && !nothingYet ? (
          <>
            <Text className="mt-4 font-body text-sm text-muted-foreground">
              From {data?.dissectCount} of your own{' '}
              {data?.dissectCount === 1 ? 'call' : 'calls'}. Nobody else&apos;s.
            </Text>

            {hasPractice(data?.practice) && data?.practice ? (
              <View className="mb-6 gap-3">
                <Text
                  accessibilityRole="header"
                  className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
                >
                  How your practice is going
                </Text>
                <Text className="font-body text-base leading-relaxed text-foreground">
                  {practiceHeadline(data.practice)}
                </Text>
                {practiceLines(data.practice).map((l) => (
                  <View
                    key={l.focus}
                    accessible
                    accessibilityLabel={l.spoken}
                    className="flex-row items-baseline justify-between gap-3 border-b border-border py-2"
                  >
                    <Text className="flex-1 font-body text-base text-foreground">{l.label}</Text>
                    <Text className="font-body text-sm text-muted-foreground">
                      {/* An em dash where the skill was drilled but never
                          reached — a 0 would read as having done it badly. */}
                      {l.score}
                      {l.direction ? ` · ${l.direction}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Group
              title="Worth working on"
              items={data?.growthAreas ?? []}
              practiceable
              router={router}
            />
            <Group title="What is already working" items={data?.strengths ?? []} />
            <Group title="Strategies to try" items={data?.strategies ?? []} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** A titled list, rendered only when it has something in it — an empty heading
 *  reads as a verdict nobody wrote. */
/**
 * One growth area, with the two things a rep can do about it.
 *
 * PRACTISE opens the roleplay seeded with this exact skill. LEARN expands a
 * short guide written from YOUR company's methodology rather than generic
 * advice — the same pair the website offers. A screen that names a weakness and
 * offers neither is just a list of things a rep is bad at.
 *
 * The guide is fetched on first open and KEPT, so collapsing and reopening does
 * not spend another generation. A failed load is retried on the next open,
 * because the error text promises exactly that.
 */
function FocusLine({
  text,
  practiceable,
  router,
}: {
  text: string;
  practiceable: boolean;
  router?: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = useState(false);
  const [material, setMaterial] = useState<CoachingMaterial | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  /** True when the route refused the app, rather than having nothing to say. */
  const [unavailable, setUnavailable] = useState(false);
  /** Signed out, or a live token refused — they have opposite fixes. */
  const [why, setWhy] = useState<AuthFailure | null>(null);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    // Fetch on first open, or retry after a failed one — never re-fetch a guide
    // already in hand.
    if (!next || loading || material) return;
    setUnavailable(false);
    setLoading(true);
    try {
      const res = await coachPost<unknown>('/api/coach/sales-session/coaching-material', {
        focus: text,
      });
      setMaterial(readCoachingMaterial(res));
    } catch (e) {
      // "The coach has nothing for this" and "the app could not reach the coach"
      // are DIFFERENT sentences, and telling a rep their coach had nothing would
      // be a lie they might repeat to their manager.
      //
      // The comment that was here said this route "still authenticates by cookie".
      // It does not — `resolveApiAuth`, "web cookie OR mobile Bearer", checked on
      // 4 September. So the reason is kept instead of assumed: signed out, or a
      // live token refused, which have opposite fixes.
      setUnavailable(isUnavailable(e));
      setWhy(authFailureOf(e));
      setMaterial(null);
    } finally {
      setLoading(false);
    }
  }, [open, loading, material, text]);

  return (
    <View className="gap-2">
      <Text className="font-body text-base leading-relaxed text-foreground">{text}</Text>
      {practiceable ? (
        <View className="flex-row flex-wrap gap-2">
          {router ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(app)/(tabs)/roleplay', params: { focus: text } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Practise this against the coach: ${text}`}
              className="min-h-7 justify-center rounded-md border border-primary px-4 active:opacity-70"
            >
              <Text className="font-emphasis text-sm text-primary">Practise this</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void toggle()}
            accessibilityRole="button"
            accessibilityState={{ expanded: open, busy: loading }}
            accessibilityLabel={`${open ? 'Hide' : 'Read'} how to do this: ${text}`}
            className="min-h-7 justify-center rounded-md border border-border-control px-4 active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-foreground">
              {loading ? 'Reading…' : open ? 'Hide' : 'How to do this'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {open && !loading ? (
        material ? (
          <View className="gap-3 rounded-lg border border-border-control px-4 py-3">
            {material.overview ? (
              <Text className="font-body text-base leading-relaxed text-foreground">
                {material.overview}
              </Text>
            ) : null}
            <Bullets title="What to do" items={material.keyMoves} />
            <Bullets title="What usually goes wrong" items={material.watchOuts} />
            <Bullets title="Lines you can adapt" items={material.exampleLines} />
          </View>
        ) : (
          <Text className="font-body text-sm leading-relaxed text-muted-foreground">
            {unavailable ? materialUnavailable(blockedState(why, 'this guide').body) : NO_MATERIAL}
          </Text>
        )
      ) : null}
    </View>
  );
}

/** A titled list, or nothing at all when the coach gave none. */
function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View className="gap-1">
      <Text className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {items.map((i) => (
        <Text key={i} className="font-body text-sm leading-relaxed text-foreground">
          • {i}
        </Text>
      ))}
    </View>
  );
}

/**
 * A list of focuses, each practiseable when it is something to work ON.
 *
 * THE POINT OF THE PRACTICE BUTTON. The website puts one on every growth area:
 * it opens the roleplay seeded with that exact skill, and the review then scores
 * whether the rep actually applied it. Without it a rep reads "you interrupt
 * when a prospect objects", agrees, and has nowhere to go — the screen names a
 * weakness and offers no way to work on it.
 *
 * ONLY ON WHAT IS WORTH WORKING ON. The website marks strengths as not
 * practiseable, and so does this: "practise what you are already good at" is
 * noise, and it would dilute the one button that matters.
 */
function Group({
  title,
  items,
  practiceable = false,
  router,
}: {
  title: string;
  items: string[];
  practiceable?: boolean;
  router?: ReturnType<typeof useRouter>;
}) {
  const real = items.filter((i) => i && i.trim());
  if (real.length === 0) return null;
  return (
    <>
      <Text
        accessibilityRole="header"
        className="mb-2 mt-7 font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
      >
        {title}
      </Text>
      <View className="gap-3">
        {real.map((item) => (
          <FocusLine key={item} text={item} practiceable={practiceable} router={router} />
        ))}
      </View>
    </>
  );
}
