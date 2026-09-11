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
 *     mis-taps and a number you cannot correct is a number you stop trusting. (That reasoning
 *     is why "Undo last" existed. REV 1 removed it on 2026-09-11; the sentence is kept because
 *     the reasoning did not stop being true, and the gap it now describes is on the build board.)
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
  type Knock,
  type KnockOutcome,
} from '@/lib/doors/knock-store';
import { PITCH_OUTCOME_LABEL as LABEL } from '@/lib/doors/outcome-label';
import { fetchMetrics } from '@/lib/doors/metrics-api';
import { FOCUS_HEADING, FOCUS_HINT, FOCUS_PENDING } from '@/lib/doors/door-screen-view';
import { fetchDayTotals, type DoorTotals } from '@/lib/doors/door-log-api';
import { useKnockSender, knockSendingStopped } from '@/lib/doors/use-knock-sender';
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
  const { flush } = useKnockSender(userId);

  const [queue, setQueue] = useState<Knock[]>([]);
  const [totals, setTotals] = useState<DoorTotals | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openingLast, setOpeningLast] = useState(false);
  /**
   * The one habit worth drilling next, brought onto this screen by REV 1.
   *
   * THREE STATES, NOT TWO. `null` is "not asked yet or could not find out" and shows nothing at
   * all; an empty string is "asked, and there isn't one yet", which shows the pending sentence.
   * Folding those together would either put a permanent placeholder on a screen a rep opens fifty
   * times a day, or hide a real answer behind a failed request.
   */
  const [focus, setFocus] = useState<string | null>(null);
  const [focusAsked, setFocusAsked] = useState(false);
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

  /*
    BEST-EFFORT, AND ASKED ONCE PER OPENING OF THIS SCREEN.

    The focus changes when pitches are analysed, not when a door is logged, so this deliberately
    does NOT re-run on every knock - a rep tapping a dial forty times would otherwise send forty
    requests for a sentence that cannot have changed. A failure leaves `focus` null and this screen
    simply does not mention it, which is right: the Door Log's job is logging doors, and a coaching
    line that could not be fetched must not become an error message in the middle of it.
  */
  useEffect(() => {
    let cancelled = false;
    fetchMetrics('day')
      .then((r) => {
        if (cancelled) return;
        setFocusAsked(true);
        setFocus(r.ok ? (r.metrics.focus?.trim() || '') : null);
      })
      .catch(() => {
        /* null, and the section stays off the screen */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  /*
    THE `undo` CALLBACK WENT WITH ITS BUTTON (REV 1, 2026-09-11).

    `undoLastKnock` itself is untouched and still exported - it is the local half of the door
    log and removing it would be a change to how knocks are stored, which is not what was asked.
    What is gone is this screen's route to it.
  */

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="px-5 pb-10">
        {/* TODAY, from this phone. Exact, always, with no network involved. */}
        <View className="mt-4 flex-row gap-3">
          <Tile value={String(waitingTotal + (totals?.doorsKnocked ?? 0))} label="Doors knocked" />
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

        {/*
          NEXT 5 DOOR FOCUS, directly under the three counts (REV 1, 2026-09-11).

          Here rather than only on Today's Metrics because this is the screen a rep has open
          between houses - a focus for "your next five doors" is worth nothing on a screen they
          open at the end of the day. The count lives in `door-screen-view.ts` so this and Today's
          Metrics cannot drift into telling a rep two different numbers.

          Hidden entirely while the answer is unknown. A heading with nothing under it reads as
          something broken, and this screen must not look broken while a rep is working.
        */}
        {focusAsked ? (
          <View className="mt-4 rounded-lg border border-border-control px-4 py-3">
            <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
              {FOCUS_HEADING}
            </Text>
            {focus ? (
              <>
                <Text className="mt-2 font-body text-base leading-relaxed text-foreground">
                  {focus}
                </Text>
                <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
                  {FOCUS_HINT}
                </Text>
              </>
            ) : (
              <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
                {FOCUS_PENDING}
              </Text>
            )}
          </View>
        ) : null}

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

        {/*
          "SEE TODAY'S METRICS" WAS HERE, and it is removed at the founder's instruction
          (REV 1, 2026-09-11) along with "Undo last" below.

          The day's figures are the three tiles at the top of this screen and the dials on the
          home page, so the link was a third route to a number the rep is already looking at.
          Today's Metrics is still reachable from its own tab.
        */}
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

        {/*
          "UNDO LAST" WAS HERE, removed at the founder's instruction (REV 1, 2026-09-11).

          SAYING WHAT THIS COSTS, and the first version of this note got it WRONG. It said the
          figure "can still be corrected from the home page - Fix today's numbers opens the place
          that owns it - so the ability is not gone, only the shortcut from here."

          That was false, and checking it is what found the real shape. "Fix today's numbers"
          NAVIGATES TO THIS SCREEN; its whole purpose was to reach the control that used to be
          here. `removeKnock` is called only by the send sweep. So removing this took away the
          only way to take back a door logged by accident, anywhere in the app - on dials that are
          large targets pressed in a hurry between houses.

          The removal stands, because it was asked for. Whether the ability comes back, and where,
          is on the build board with the trade written out.

          THE ROW WENT WITH IT. It was a `justify-between` pair - the control on the left, this
          notice on the right - and with one child left it was a layout container arranging
          nothing, plus a large-text branch choosing between two ways of arranging nothing. The
          notice is a line of text and is now written as one.
        */}
        {/* One live region, so a screen reader hears "Sold logged" rather than a number changing
            silently somewhere above. */}
        <Text
          accessibilityLiveRegion="polite"
          className="mt-4 font-body text-sm text-muted-foreground"
        >
          {notice ?? ''}
        </Text>
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
