/**
 * Home — and there are TWO of them, because Macro Mode swaps the product.
 *
 * Both are mirrored from `dashboard/sales-coach/page.tsx`, read rather than
 * remembered.
 *
 *   MACRO ON  → the door-to-door home: one hero Door Log card, the Macro Mode
 *               switch, three door counts, and "Start Knocking".
 *   MACRO OFF → the standard launchpad: a grid of cards, three call counts, and
 *               "Start recording".
 *
 * TWO THINGS SEEN ON A REAL DEVICE AND FIXED HERE, neither of which a clean
 * build could have shown:
 *
 *   1. THE GREETING WAS BURIED UNDER THE STATUS BAR. When the tab bar took over
 *      and the header was turned off, nothing was left to supply the top inset,
 *      and this screen still guarded only the bottom edge. Ignoring safe-area
 *      insets is on the design law's banned list, and this is exactly why.
 *
 *   2. THE CONTENT SAT AT THE TOP WITH DEAD SPACE BELOW IT. The container now
 *      grows and centres, so a short screen sits in the middle of the phone and
 *      a long one scrolls normally. Nothing is cropped either way.
 *
 * THE NAME IS READ, NOT GUESSED. It used to be derived from the email, so
 * `johnsyramos@gmail.com` was greeted as "Johnsyramos". The web reads
 * `profiles.full_name` and shows "Johns Ramos"; this now does the same, straight
 * from the database under RLS.
 *
 * That fix was only half of it, and the other half survived until 4 September:
 * a profile WITHOUT a full name still fell through to an email-derived guess,
 * so the very address named above still produced "Welcome Johnsyramos" for any
 * rep an admin had not given a name to. `firstNameFrom` no longer looks at the
 * email at all — the web does not either, and it renders "back" — so the
 * fallback below now genuinely means "we do not know your name" rather than
 * "we will invent one".
 */
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import { listMySessions } from '@/lib/sync/sessions';
import { readCachedSessions } from '@/lib/sync/cache';
import { countPending } from '@/lib/audio/recording-store';
import { readMyProfile } from '@/lib/profile';
import { buildHomeView, type HomeStat } from '@/lib/home-view';
import { useMacroMode } from '@/lib/doors/macro-context';
import { countByOutcome, listKnocks, localDate } from '@/lib/doors/knock-store';
import { fetchDayTotals, type DoorTotals } from '@/lib/doors/door-log-api';
import { buildDoorTiles } from '@/lib/doors/door-tiles';
import { useLargeText } from '@/lib/use-large-text';
import type { CoachingSession } from '@/types/backend';
import { C } from '@/lib/theme';
import { HeaderMenu } from '@/components/header-menu';
import { homeMenuItems } from '@/lib/home-menu';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const stacked = useLargeText();
  const macro = useMacroMode();

  const [fullName, setFullName] = useState<string | null>(null);
  const [sessions, setSessions] = useState<CoachingSession[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [doorTotals, setDoorTotals] = useState<DoorTotals | null>(null);
  const [doorsWaiting, setDoorsWaiting] = useState({ total: 0, sold: 0, goBack: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setFullName((await readMyProfile(userId)).fullName);

    // The doors this phone is holding — exact, and needing no network.
    const today = localDate();
    const knocks = await listKnocks(userId).catch(() => []);
    const counts = countByOutcome(knocks, today);
    setDoorsWaiting({
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      sold: counts.sold,
      goBack: counts.go_back,
    });
    fetchDayTotals(today).then(setDoorTotals);

    const cached = await readCachedSessions(userId).catch(() => null);
    if (cached) setSessions((prev) => prev ?? cached.rows);
    setWaiting(await countPending(userId).catch(() => null));
    try {
      const { rows, hasMore: more } = await listMySessions();
      setSessions(rows);
      setHasMore(more);
    } catch {
      // Left as the cache gave it, or null — `buildHomeView` renders an em dash
      // for a figure it could not work out, never a zero.
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const view = buildHomeView({
    sessions,
    hasMore,
    pendingRecordings: waiting,
    fullName,
    email: user?.email ?? null,
  });

  const isMacro = macro.enabled === true;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView
        // `grow` + `justify-center` so a short screen sits in the middle of the
        // phone rather than jammed under the status bar with dead space below,
        // and a long one still scrolls.
        contentContainerClassName="grow justify-center px-5 py-6"
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
        {/* The overflow menu sits above the welcome, on its own row, so the
            greeting stays centred on the screen rather than being pushed off
            centre by a control beside it. Account lives in here now — see
            header-menu.tsx for why it left the tab bar. */}
        <View className="flex-row justify-end">
          <HeaderMenu
            items={homeMenuItems(isMacro).map((item) => ({
              ...item,
              onPress: () => router.push(item.route as Parameters<typeof router.push>[0]),
            }))}
          />
        </View>

        {/* The welcome, centred and in the brand colour — the web's header, with
            its own fallback: no name reads "Welcome back", never an email. */}
        <View className="items-center pb-6">
          <Text
            accessibilityRole="header"
            className="text-center font-heading text-2xl text-primary"
          >
            Welcome
          </Text>
          <Text className="text-center font-heading text-2xl leading-tight text-primary">
            {view.fullName ?? view.firstName ?? 'back'}
          </Text>
        </View>

        {isMacro ? (
          <MacroHome
            router={router}
            stacked={stacked}
            totals={doorTotals}
            waiting={doorsWaiting}
            macro={macro}
          />
        ) : (
          <StandardHome router={router} stacked={stacked} stats={view.stats} partial={view.partial} macro={macro} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The door-to-door home.
 *
 * ONE hero card, as on the web — the Door Log is the only thing a knocking rep
 * opens this screen to do, and four equal cards would make it one of four.
 */
function MacroHome({
  router,
  stacked,
  totals,
  waiting,
  macro,
}: {
  router: ReturnType<typeof useRouter>;
  stacked: boolean;
  totals: DoorTotals | null;
  waiting: { total: number; sold: number; goBack: number };
  macro: ReturnType<typeof useMacroMode>;
}) {
  // Never `?? 0`. A failed totals read used to render as "0 DOORS TODAY" for a
  // rep whose forty doors were all safely on the server — see door-tiles.ts.
  const { tiles, anyPartial } = buildDoorTiles({ waiting, totals });

  return (
    <>
      <Pressable
        onPress={() => router.push('/(app)/doors')}
        accessibilityRole="button"
        accessibilityLabel="Door log. Log every door, fast."
        className="min-h-9 items-center justify-center rounded-lg border border-primary px-5 py-10 active:bg-surface"
      >
        <Text className="font-strong text-xl text-foreground">Door Log</Text>
        <Text className="mt-1 font-body text-sm text-muted-foreground">Log every door, fast</Text>
      </Pressable>

      <MacroSwitch macro={macro} />

      <View className="mt-3 flex-row gap-3">
        {tiles.map((t) => (
          <Tile
            key={t.key}
            value={t.value}
            label={t.label}
            emphasis={t.emphasis}
            spoken={t.spoken}
          />
        ))}
      </View>

      {/*
        Said ONCE, under the row, rather than repeated on every tile — and both
        of these, when both are true.

        They used to be an if / else-if, so a rep saw one or the other. The case
        where both apply is OFFLINE, which is when a door rep most needs each of
        them: one says the figure above is incomplete, the other says the work
        they are holding is not lost. Suppressing either in that moment is
        suppressing it in the only moment it mattered.

        The same defect, in the opposite order, was on the Door Log screen.
      */}
      {anyPartial ? (
        <Text className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
          Today&apos;s totals could not be read from the server, so these show only what this
          phone has logged. Your earlier doors are safe — they are just not counted here yet.
        </Text>
      ) : null}
      {waiting.total > 0 ? (
        <Text className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
          {waiting.total} of these {waiting.total === 1 ? 'is' : 'are'} still on this phone and
          will send on their own.
        </Text>
      ) : null}

      <Pressable
        onPress={() => router.push('/(app)/doors')}
        accessibilityRole="button"
        accessibilityLabel="Start knocking"
        className="mt-5 min-h-7 items-center justify-center rounded-lg bg-primary px-5 py-4 active:bg-primary-pressed"
      >
        <Text className="font-strong text-base text-primary-foreground">Start Knocking</Text>
      </Pressable>
    </>
  );
}

/** The standard coach home — the web's 2×2 launchpad. */
function StandardHome({
  router,
  stacked,
  stats,
  partial,
  macro,
}: {
  router: ReturnType<typeof useRouter>;
  stacked: boolean;
  stats: HomeStat[];
  partial: boolean;
  macro: ReturnType<typeof useMacroMode>;
}) {
  return (
    <>
      <View className={stacked ? 'gap-3' : 'flex-row gap-3'}>
        <Card
          title="Record a call"
          hint="Capture it, then read it back"
          onPress={() => router.push('/(app)/record')}
          lead
        />
        <Card
          title="Your sessions"
          hint="Every call, with its transcript"
          onPress={() => router.push('/(app)/(tabs)/sessions')}
        />
      </View>

      <View className={`mt-3 ${stacked ? 'gap-3' : 'flex-row gap-3'}`}>
        <Card
          title="Roleplay"
          hint="Practise a pitch, get a review"
          onPress={() => router.push('/(app)/(tabs)/roleplay')}
        />
        <Card
          title="Ask the coach"
          hint="Paste a conversation, get an answer"
          onPress={() => router.push('/(app)/coach')}
        />
      </View>

      {/*
        * The web's Home grid carries these two as well, and on a phone they are
        * not reachable any other way: neither One Liners nor a Home card for
        * Analytics is in the web's MOBILE_TABS, so its Home grid IS the route to
        * them. One Liners was worse off here than on the web — it sat two taps
        * deep behind Account, when its own purpose is to be opened for fifteen
        * seconds on a doorstep before knocking. That is not a screen to bury.
        *
        * "Pitch Analytics" is the web's own card label; its nav says "Analytics",
        * exactly as this app's tab does. Copying both labels rather than
        * unifying them keeps the two products saying the same words.
        */}
      <View className={`mt-3 ${stacked ? 'gap-3' : 'flex-row gap-3'}`}>
        <Card
          title="One Liners"
          hint="Lines that worked, from your own calls"
          onPress={() => router.push('/(app)/oneliners')}
        />
        <Card
          title="Pitch Analytics"
          hint="How you sell, graded"
          onPress={() => router.push('/(app)/(tabs)/analytics')}
        />
      </View>

      <MacroSwitch macro={macro} />

      <View className="mt-3 flex-row gap-3">
        {stats.map((s) => (
          <Tile key={s.key} value={s.value} label={s.label} emphasis={s.emphasis} spoken={s.spoken} />
        ))}
      </View>

      {partial ? (
        <Text className="mt-2 font-body text-xs leading-relaxed text-muted-foreground">
          Counts cover the calls loaded so far. Older ones are not counted yet.
        </Text>
      ) : null}

      <Pressable
        onPress={() => router.push('/(app)/record')}
        accessibilityRole="button"
        accessibilityLabel="Start recording a call"
        className="mt-5 min-h-7 items-center justify-center rounded-lg bg-primary px-5 py-4 active:bg-primary-pressed"
      >
        <Text className="font-strong text-base text-primary-foreground">Start recording</Text>
      </Pressable>
    </>
  );
}

/**
 * The Macro Mode switch, as on the web home.
 *
 * A real `Switch`, not a styled Pressable: it carries the platform's own
 * accessibility role and state, and a switch-control user already knows what one
 * is. The description says what it CHANGES, because a rep who flips it finds
 * their whole navigation different and deserves to have been told.
 */
function MacroSwitch({ macro }: { macro: ReturnType<typeof useMacroMode> }) {
  if (macro.enabled === null) return null;
  return (
    <View className="mt-3 flex-row items-center gap-3 rounded-lg border border-border-control px-4 py-3">
      <View className="flex-1">
        <Text className="font-strong text-base text-foreground">Macro Mode</Text>
        <Text className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
          Door-to-door: fast Door Log and a macro Report Card, with the door surfaces in the tab
          bar.
          {macro.unsynced
            ? ' Saved on this phone — it has not reached the server, so the website still shows the old setting.'
            : ''}
        </Text>
      </View>
      <Switch
        value={macro.enabled}
        onValueChange={macro.toggle}
        // NOT disabled when the server refuses. The phone honours the choice and
        // syncs later, exactly as an outcome typed in a stairwell does.
        disabled={macro.saving}
        accessibilityLabel="Macro Mode"
        accessibilityHint="Switches between the door-to-door surfaces and the standard coach"
        trackColor={{ false: C['border-control'], true: C.primary }}
        thumbColor={C.foreground}
      />
    </View>
  );
}

function Card({
  title,
  hint,
  onPress,
  lead,
}: {
  title: string;
  hint: string;
  onPress: () => void;
  lead?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      className={`min-h-7 flex-1 justify-center rounded-lg border px-4 py-5 active:bg-surface ${
        lead ? 'border-primary' : 'border-border-control'
      }`}
    >
      <Text className="font-strong text-base text-foreground">{title}</Text>
      <Text className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">{hint}</Text>
    </Pressable>
  );
}

function Tile({
  value,
  label,
  emphasis,
  spoken,
}: {
  value: string;
  label: string;
  emphasis?: boolean;
  spoken?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={spoken ?? `${value} ${label}`}
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
      <Text className="text-center font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
    </View>
  );
}
