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
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import { listMySessions } from '@/lib/sync/sessions';
import { readCachedSessions } from '@/lib/sync/cache';
import { countPending } from '@/lib/audio/recording-store';
import { readMyProfile } from '@/lib/profile';
import { buildHomeView, type HomeStat } from '@/lib/home-view';
import { useMacroMode } from '@/lib/doors/macro-context';
import { countByOutcome, listKnocks, localDate } from '@/lib/doors/knock-store';
import { useLargeText } from '@/lib/use-large-text';
import type { CoachingSession } from '@/types/backend';
import { C } from '@/lib/theme';
import { HeaderMenu } from '@/components/header-menu';
import { homeMenuItems } from '@/lib/home-menu';
import { SwipePager } from '@/components/swipe-pager';
import { PaneBoundary } from '@/components/pane-boundary';
import { DoorHomePage } from '@/components/door-home-page';
import { homePagerHint } from '@/lib/doors/door-screen-view';

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

  /**
   * The Home tab, tapped — spec 06 §3: "the Home tab also snaps back to page 0."
   *
   * IT IS THE TAB PRESS, not focus. Focus also fires when a rep comes BACK from
   * the Door Log, and rewinding them there would take the page away from someone
   * who never asked to move. The web fires its own `elostate:home-tab` event on
   * the same gesture, and this is that event's native equivalent.
   */
  const navigation = useNavigation();
  const subscribeHomeTab = useCallback(
    (goToFirst: () => void) =>
      // `tabPress` is a bottom-tabs event rather than a base-navigator one, so
      // the type is widened at the call rather than the listener rewritten.
      navigation.addListener('tabPress' as never, goToFirst as never),
    [navigation],
  );

  const view = buildHomeView({
    sessions,
    hasMore,
    pendingRecordings: waiting,
    fullName,
    email: user?.email ?? null,
  });

  const isMacro = macro.enabled === true;

  const menu = (
    /* The overflow menu sits above the welcome, on its own row, so the greeting
       stays centred on the screen rather than being pushed off centre by a
       control beside it. Account lives in here now — see header-menu.tsx for why
       it left the tab bar. */
    <View className="flex-row justify-end">
      <HeaderMenu
        items={homeMenuItems(isMacro).map((item) => ({
          ...item,
          onPress: () => router.push(item.route as Parameters<typeof router.push>[0]),
        }))}
      />
    </View>
  );

  const welcome = (
    /* The web's header, with its own fallback: no name reads "Welcome back",
       never an email. */
    <View className="items-center pb-6">
      <Text accessibilityRole="header" className="text-center font-heading text-2xl text-primary">
        Welcome
      </Text>
      <Text className="text-center font-heading text-2xl leading-tight text-primary">
        {view.fullName ?? view.firstName ?? 'back'}
      </Text>
    </View>
  );

  const refresh = (
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
  );

  /**
   * MACRO MODE IS THE ONLY MODE THAT PAGES, which is the web's own shape — its
   * home renders the pager under `macroOn === true` and the plain launchpad
   * otherwise. A rep coaching phone calls has no door funnel, and opening them
   * on a door tracker would be the app insisting they are somebody else.
   *
   * THE MENU SITS ABOVE THE PAGER, not inside page 1 — the web keeps its own
   * shared control ("Back to ELOSTATE") above the track for the same reason.
   * Account and the rest have to be reachable from the page a rep LANDS on, and
   * burying them one swipe away would be hiding navigation behind a gesture.
   */
  if (isMacro) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="px-5 pt-2">{menu}</View>
        <SwipePager
          subscribeReset={subscribeHomeTab}
          // The founder's mockup: two dots and a swipe hint under the page,
          // rather than a segmented control above it. The HINT is the button and
          // the dots report position - see swipe-pager.tsx for the arithmetic
          // that decided which is which, and why it still looks like the mockup.
          control="dots"
          hint={homePagerHint}
          pages={[
            {
              key: 'doors',
              label: 'Doors',
              render: () => (
                // Each pane has its OWN boundary: a throw in the door target must
                // not take the launchpad with it, and vice versa.
                <PaneBoundary name="door-home" subject="Your door target">
                  <DoorHomePage />
                </PaneBoundary>
              ),
            },
            {
              key: 'home',
              label: 'Home',
              render: () => (
                <PaneBoundary name="macro-home" subject="Your home screen">
                  <ScrollView
                    contentContainerClassName="grow justify-center px-5 pb-6"
                    refreshControl={refresh}
                  >
                    {welcome}
                    <MacroHome router={router} waiting={doorsWaiting} macro={macro} />
                  </ScrollView>
                </PaneBoundary>
              ),
            },
          ]}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView
        // `grow` + `justify-center` so a short screen sits in the middle of the
        // phone rather than jammed under the status bar with dead space below,
        // and a long one still scrolls.
        contentContainerClassName="grow justify-center px-5 py-6"
        refreshControl={refresh}
      >
        {menu}
        {welcome}
        <StandardHome
          router={router}
          stacked={stacked}
          stats={view.stats}
          partial={view.partial}
          macro={macro}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * The door-to-door home — page 1 of the pager.
 *
 * ONE hero card, as on the web — the Door Log is the only thing a knocking rep
 * opens this screen to do, and four equal cards would make it one of four.
 *
 * THE THREE COUNT BUBBLES ARE GONE (spec 06 §5, and the web's own commit
 * `0433058b`). Doors knocked / go backs / sold now live on page 0 as dials with
 * targets, and the same three numbers on both pages would have been two answers
 * to one question, one of them without a target to read it against.
 *
 * WHAT DID NOT GO WITH THEM is the outbox line: doors this phone is holding are
 * still named here, and now on page 0 as well (see `pendingNote`). That sentence
 * was the only thing standing between an undercount and a rep believing they had
 * knocked fewer doors than they had, so it moved rather than being deleted.
 *
 * `stacked` (the large-text signal) is no longer taken: the row it would have
 * governed was the bubble row, and nothing left here lays out side by side.
 */
function MacroHome({
  router,
  waiting,
  macro,
}: {
  router: ReturnType<typeof useRouter>;
  waiting: { total: number; sold: number; goBack: number };
  macro: ReturnType<typeof useMacroMode>;
}) {
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

      {/*
        The outbox, said in full rather than as a footnote to a row of numbers
        that is no longer here. "These" had a referent when three bubbles sat
        above it; without them the sentence has to carry its own subject.
      */}
      {waiting.total > 0 ? (
        <Text className="mt-3 font-body text-xs leading-relaxed text-muted-foreground">
          {waiting.total} {waiting.total === 1 ? 'door' : 'doors'} logged on this phone{' '}
          {waiting.total === 1 ? 'has' : 'have'} not reached the server yet.{' '}
          {waiting.total === 1 ? 'It' : 'They'} will send on their own.
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
