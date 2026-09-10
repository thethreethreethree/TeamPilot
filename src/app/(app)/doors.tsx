/**
 * Door Log — the web app's Macro Mode surface, on the phone it belongs on.
 *
 * WHY THIS IS THE ONE THAT MATTERED MOST. The owner's own web app is running in
 * Macro Mode, which means their reps knock doors for a living. Everything else
 * this app does happens after a conversation; this happens DURING the working
 * day, at every door, dozens of times an hour. It is also the surface a phone is
 * better at than a laptop, which is the whole argument for the app existing.
 *
 * DESIGNED FOR ONE THUMB, WALKING, IN THE SUN.
 *   - Five big targets, each far above the 48dp floor. A rep is not looking at
 *     the screen when they tap it; they are looking at a door.
 *   - No confirmation, ever. A dialog between the rep and the next house is a
 *     feature that gets abandoned by lunchtime.
 *   - The count moves on the TAP, from the local queue, not when the server
 *     answers. Waiting on a network to acknowledge a door is how a rep in a
 *     basement stops believing the app.
 *   - Undo is one tap and sits beside the buttons, because fast tapping produces
 *     mis-taps and a number you cannot correct is a number you stop trusting.
 *
 * WHAT IT WILL NOT DO. It will not show a total it cannot stand behind. The
 * server's own route refuses to return a strip of zeros when a read fails, and
 * this screen holds the same line: the local count is always exact and always
 * shown, and the server's figure is shown only when it actually arrived — said
 * apart rather than silently added, so a rep can see which is which.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import {
  addKnock,
  countByOutcome,
  listKnocks,
  localDate,
  undoLastKnock,
  type Knock,
  type KnockOutcome,
} from '@/lib/doors/knock-store';
import { PITCH_OUTCOME_LABEL as LABEL } from '@/lib/doors/outcome-label';
import { fetchDayTotals, type DoorTotals } from '@/lib/doors/door-log-api';
import { useKnockSender, knockSendingStopped } from '@/lib/doors/use-knock-sender';
import { useLargeText } from '@/lib/use-large-text';
import { fetchLatestPitchId } from '@/lib/doors/door-log-api';
import { latestPitchTarget } from '@/lib/doors/latest-pitch';

/**
 * The five outcomes, in the server's vocabulary, worded the way a rep says them.
 *
 * Order is the order they HAPPEN in, not alphabetical and not by importance: a
 * knock is most often no answer, and the button a thumb finds without looking
 * should be the one pressed most. "Sold" is second because it is the one nobody
 * wants to fumble.
 */
const BUTTONS: { outcome: KnockOutcome; label: string; lead?: boolean }[] = [
  { outcome: 'no_answer', label: 'No answer' },
  { outcome: 'sold', label: 'Sold', lead: true },
  { outcome: 'go_back', label: 'Go back' },
  { outcome: 'non_decision_maker', label: 'Not the decision maker' },
  { outcome: 'not_interested', label: 'Not interested' },
];


export default function DoorsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const stacked = useLargeText();
  const { flush } = useKnockSender(userId);

  const [queue, setQueue] = useState<Knock[]>([]);
  const [totals, setTotals] = useState<DoorTotals | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openingLast, setOpeningLast] = useState(false);
  const today = localDate();

  const refresh = useCallback(async () => {
    if (!userId) return;
    setQueue(await listKnocks(userId).catch(() => []));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // The server's own total for today, best-effort. Its absence is not an error
  // on this screen — the local count is what the rep is working from.
  useEffect(() => {
    let cancelled = false;
    fetchDayTotals(today).then((t) => {
      if (!cancelled) setTotals(t);
    });
    return () => {
      cancelled = true;
    };
  }, [today, queue.length]);

  const waiting = countByOutcome(queue, today);
  const waitingTotal = Object.values(waiting).reduce((a, b) => a + b, 0);

  const knock = useCallback(
    async (outcome: KnockOutcome) => {
      if (!userId) return;
      // Local first, on purpose: the number on screen moves before anything
      // touches the network.
      await addKnock(userId, outcome);
      await refresh();
      setNotice(`${LABEL[outcome]} logged`);
      flush();
    },
    [userId, refresh, flush],
  );

  const undo = useCallback(async () => {
    if (!userId) return;
    const undone = await undoLastKnock(userId);
    await refresh();
    setNotice(
      undone
        ? `${LABEL[undone.outcome]} taken back`
        : 'Nothing left to take back — everything is on the server.',
    );
  }, [userId, refresh]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="px-5 pb-10">
        {/* TODAY, from this phone. Exact, always, with no network involved. */}
        <View className="mt-4 flex-row gap-3">
          <Tile value={String(waitingTotal + (totals?.doorsKnocked ?? 0))} label="Doors today" />
          <Tile
            value={String(waiting.sold + (totals?.sold ?? 0))}
            label="Sold"
            emphasis={waiting.sold + (totals?.sold ?? 0) > 0}
          />
          <Tile
            value={String(waiting.go_back + (totals?.goBacks ?? 0))}
            label="Go backs"
          />
        </View>

        {/* Said plainly rather than folded into the numbers above. A rep who
            cannot tell what the server has from what their phone is still
            holding cannot tell whether their manager can see today's work. */}
        {/*
          TWO SEPARATE FACTS, AND THEY USED TO BE MUTUALLY EXCLUSIVE.

          These were an if / else-if: unsent doors, OR an unreadable server
          total. Both can be true at once — and the case where both are true is
          OFFLINE, which is this screen's whole reason for existing. So the one
          condition that hid the warning was the exact condition the warning was
          written for: a rep in a dead zone saw "7 doors are still on this
          phone" and no hint that the number above it was missing the server's
          share of the day.

          They answer different questions and both deserve saying. The first is
          about SENDING — has my work left the phone. The second is about the
          NUMBER — does the figure above mean what it looks like.
        */}
        {waitingTotal > 0 ? (
          <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
            {waitingTotal} {waitingTotal === 1 ? 'door is' : 'doors are'} still on this phone.
            {knockSendingStopped()
              ? ' The app cannot send them to the server yet — they are being held safely here.'
              : ' They send on their own.'}
          </Text>
        ) : null}
        {totals === null ? (
          <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
            Today&apos;s total from the server could not be read, so this shows only what this
            phone has logged. Nothing is lost.
          </Text>
        ) : null}

        <Text
          accessibilityRole="header"
          className="mb-2 mt-6 font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
        >
          Log a door
        </Text>

        <View className="gap-3">
          {BUTTONS.map((b) => (
            <Pressable
              key={b.outcome}
              onPress={() => knock(b.outcome)}
              accessibilityRole="button"
              accessibilityLabel={`Log ${b.label}`}
              // Deliberately taller than the 48dp floor. This is pressed without
              // looking, and a target sized to the text is a target a walking
              // thumb misses.
              className={`min-h-9 items-center justify-center rounded-lg border px-5 py-5 active:bg-surface ${
                b.lead ? 'border-primary' : 'border-border-control'
              }`}
            >
              <Text
                className={`font-strong text-lg ${b.lead ? 'text-primary' : 'text-foreground'}`}
              >
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/*
          * RECORDING THE PITCH, which in Macro Mode was reachable from nowhere.
          *
          * The web's Door Log has the recorder built into it — a door rep knocks,
          * somebody answers, and they record from the same surface. This app had
          * the recorder only on the standard Home and inside one empty state, and
          * neither is reachable with Macro Mode on. So the rep this app was built
          * for — the one knocking doors all day — could not record a pitch without
          * first switching the mode off, while the "Pitch Performance" tab beside
          * them listed pitches they had no way to create.
          *
          * Filled, not a text link: this is the second thing a rep does at a door
          * that opens, not a place to navigate to. It sits under the five outcome
          * buttons because that is the order it happens in — the knock is logged
          * first, and the buttons stay the thing a thumb finds without looking.
          *
          * IT OPENS THE DOOR-PITCH RECORDER, not the coaching-session one, and
          * that distinction is the whole point. `?pitch=1` puts the recorder in
          * door mode: on stopping it asks how the door ended, then posts to the
          * door-log route, which creates a knock AND a pitch — so it counts
          * toward doors knocked and appears in Pitch Performance.
          *
          * It pointed at the session recorder for a day (3–4 September). That
          * was my mistake: a rep would have recorded a pitch and never found it
          * where they looked. Corrected on the owner's decision.
          */}
        <Pressable
          onPress={() => router.push({ pathname: '/(app)/record', params: { pitch: '1' } })}
          accessibilityRole="button"
          accessibilityLabel="Record this pitch"
          className="mt-5 min-h-9 items-center justify-center rounded-lg bg-primary px-5 py-4 active:bg-primary-pressed"
        >
          <Text className="font-strong text-base text-primary-foreground">Record this pitch</Text>
        </Pressable>

        {/* Where a rep goes after a street: how the day is actually going.
            Below the buttons, because logging is what this screen is FOR. */}
        <Pressable
          onPress={() => router.push('/(app)/(tabs)/metrics')}
          accessibilityRole="button"
          accessibilityLabel="See today's metrics"
          className="mt-5 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">See today&apos;s metrics</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(app)/(tabs)/pitches')}
          accessibilityRole="button"
          accessibilityLabel="See how your pitches went"
          className="mt-2 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">See how your pitches went</Text>
        </Pressable>

        {/* The web's /report-card/latest redirect, done on the phone. It reads
            `pitches` directly under RLS, so it works without the backend branch.
            Both failure modes land on the list, which has its own honest empty
            and error states — never a dead end at the end of a day of knocking. */}
        <Pressable
          onPress={async () => {
            if (!userId || openingLast) return;
            setOpeningLast(true);
            const target = latestPitchTarget(await fetchLatestPitchId(userId));
            setOpeningLast(false);
            if (target.kind === 'pitch') {
              router.push({
                pathname: '/(app)/pitch/[pitchId]',
                params: { pitchId: target.pitchId },
              });
            } else {
              router.push('/(app)/(tabs)/pitches');
            }
          }}
          disabled={openingLast}
          accessibilityRole="button"
          accessibilityState={{ disabled: openingLast }}
          accessibilityLabel="Open the result of your last pitch"
          className="mt-2 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">
            {openingLast ? 'Opening…' : 'Open my last pitch'}
          </Text>
        </Pressable>

        <View className={`mt-4 ${stacked ? 'gap-3' : 'flex-row items-center justify-between gap-3'}`}>
          <Pressable
            onPress={undo}
            accessibilityRole="button"
            accessibilityLabel="Take back the last door logged"
            className="min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-base text-primary">Undo last</Text>
          </Pressable>

          {/* One live region, so a screen reader hears "Sold logged" rather than
              a number changing silently somewhere above. */}
          <Text
            accessibilityLiveRegion="polite"
            className="font-body text-sm text-muted-foreground"
          >
            {notice ?? ''}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({
  value,
  label,
  emphasis,
}: {
  value: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${value} ${label}`}
      className={`flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-3 ${
        emphasis ? 'border-primary bg-surface' : 'border-border-control'
      }`}
    >
      <Text
        className={`font-heading text-2xl tabular-nums ${
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
