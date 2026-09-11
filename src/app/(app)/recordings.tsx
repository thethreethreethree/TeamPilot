/**
 * Recordings still on this phone.
 *
 * THIS SCREEN IS THE SAFETY NET MADE VISIBLE. A rep who records four calls in a
 * dead zone needs to be able to see that all four are still there. The most
 * important thing it does is not sending — it is showing, plainly and at a
 * glance, that nothing has been lost.
 *
 * WHY THE NAME IS ASKED FOR HERE AND NOT BEFORE RECORDING. The server needs a
 * client label to create a session. Asking for it at the door, before the
 * conversation, would put a form between the rep and the moment they are trying
 * to capture. So capture is free and naming happens afterwards, when they are
 * back in the van.
 *
 * DELETING IS DELIBERATELY AWKWARD. Everything else in this app can be fetched
 * again; a recording cannot. The confirmation says what is actually lost.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import {
  listRecordings,
  uploaderFor,
  removeRecording,
  updateRecording,
  type PendingRecording,
} from '@/lib/audio/recording-store';
import { deleteRecordingFile, recordingFileExists } from '@/lib/audio/capture';
import { autoTitle, filedAs, isAutoTitled } from '@/lib/audio/auto-title';
import { sendability } from '@/lib/audio/recording-budget';
import { RECORDING_AVAILABLE } from '@/lib/audio/module';
import { RecordingPlayer } from '@/components/recording-player';
import * as Sharing from 'expo-sharing';
import { uploadRecording } from '@/lib/audio/upload';
import {
  autoSendGaveUp,
  clearAutoSendStop,
  isSendable,
  runAutoSend,
} from '@/lib/audio/auto-send';
import { useOnline, isOffline } from '@/lib/use-online';
import { clockTime, parseMoney, shortDate } from '@/lib/format';
import { OutcomePicker } from '@/components/outcome-picker';
import type { SessionOutcome } from '@/types/backend';
import { C } from '@/lib/theme';

/** Minutes and seconds, said the way a person says a call length. */
/**
 * How long a recording is.
 *
 * Zero is not a length, it is an ABSENCE of one — a call recovered after the app
 * was killed mid-conversation has no duration, because nothing was running when
 * it ended. Rendering that as "0 sec" would state a fact about the call that is
 * false, and would make an hour-long conversation look like a mis-tap the rep
 * would then delete.
 */
function spokenLength(ms: number): string {
  if (!ms || ms <= 0) return 'Length unknown';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds} sec`;
  return `${minutes} min ${String(seconds).padStart(2, '0')} sec`;
}

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function RecordingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [rows, setRows] = useState<PendingRecording[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  /** Recordings that are named and not already sent — the ones "send all" would
   *  actually touch. Counted from the same rule auto-send uses, so the button
   *  never promises to send something the sender will skip. */
  const readyToSend = (rows ?? []).filter(isSendable).length;

  /**
   * How much of the phone these are using.
   *
   * Worth showing because recordings cannot reach the server yet, so they
   * accumulate — and the recorder already refuses to start when the disk is
   * nearly full. A rep who hits that refusal should be able to see what is
   * taking the room and decide what to do, rather than being told to "free some
   * space" with no idea that this app is holding it.
   */
  const totalBytes = (rows ?? [])
    .filter((r) => r.status !== 'uploaded')
    .reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const online = useOnline();
  const offline = isOffline(online);

  /**
   * Players are torn down when this screen is not the one being looked at.
   *
   * Navigating forward to the recorder does NOT unmount this screen — it stays
   * alive underneath — so a player left running would still hold the audio
   * session while the rep starts recording, and the new recording would come out
   * quiet or refuse to start. Unmounting them here reuses the release the player
   * already does on cleanup rather than inventing a second path.
   */
  const focused = useIsFocused();

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      return;
    }
    setRows(await listRecordings(userId));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Write the name to the store, not just to this screen's state.
   *
   * Automatic sending reads the name off the recording, so a name that lives
   * only in a text input is a name auto-send can never see — a rep would type
   * one, leave, and the call would sit there for ever under a rule nobody told
   * them about. Saved on blur rather than per keystroke: one write when they
   * finish, not one per letter.
   */
  const saveLabel = useCallback(
    async (rec: PendingRecording, text: string) => {
      if (!userId) return;
      const label = text.trim() || null;
      if (label === (rec.label ?? null)) return;
      await updateRecording(userId, rec.clientId, { label });
      await load();
    },
    [userId, load],
  );

  /**
   * The optional context, saved the same way and for the same reason: it has to
   * reach the store, because the upload reads it from there and a value that
   * lives only in a text input never reaches the server.
   */
  const saveContext = useCallback(
    async (
      rec: PendingRecording,
      patch: { territory?: string; approach?: string; offer?: string },
    ) => {
      if (!userId) return;
      const next: Partial<PendingRecording> = {};
      if (patch.territory !== undefined) next.territory = patch.territory.trim() || null;
      if (patch.approach !== undefined) next.approach = patch.approach.trim() || null;
      if (patch.offer !== undefined) next.offer = patch.offer.trim() || null;

      // Nothing actually changed — skip the write and the reload it triggers.
      const unchanged = Object.entries(next).every(
        ([key, value]) => value === (rec[key as keyof PendingRecording] ?? null),
      );
      if (unchanged) return;

      await updateRecording(userId, rec.clientId, next);
      await load();
    },
    [userId, load],
  );

  /**
   * The outcome, and the deal value if there is one.
   *
   * The value is parsed here rather than trusted: a rep types "1,500" or "$1500"
   * or nothing at all, and the server takes a number. Anything that is not a
   * plain amount is stored as absent rather than as a guess — the same rule the
   * money formatter follows in the other direction.
   */
  const saveOutcome = useCallback(
    async (
      rec: PendingRecording,
      patch: { outcome?: SessionOutcome; dealValue?: string },
    ) => {
      if (!userId) return;
      const next: Partial<PendingRecording> = {};
      if (patch.outcome !== undefined) next.outcome = patch.outcome;
      if (patch.dealValue !== undefined) next.dealValue = parseMoney(patch.dealValue);
      await updateRecording(userId, rec.clientId, next);
      await load();
    },
    [userId, load],
  );

  const send = useCallback(
    async (rec: PendingRecording) => {
      if (!userId) return;
      /*
        NO LONGER REFUSED FOR WANT OF A NAME (REV 1, 2026-09-11).

        This used to stop here with "Name this call first", explaining that "the server files a
        recording under the customer it belongs to, so it needs a name before it can be sent."
        The server never required it. The app did, in `isSendable`, and this alert was the
        hand-sent half of the same rule - so a rep watching the screen was told a fact about the
        server that was not true, about a refusal that was ours.

        `filedAs` gives an unnamed recording a name made of what is actually known.
      */
      const label = filedAs({
        label: labels[rec.clientId] ?? rec.label,
        recordedAt: rec.recordedAt,
        kind: rec.kind,
      });
      setBusyId(rec.clientId);
      try {
        // BRANCHES ON THE PIPELINE, exactly as the automatic sweep does. This
        // is the HAND-SENT path; fixing only the sweep would have left this
        // button posting a door pitch as a coaching session — the same mistake,
        // surviving in the one place a rep uses when they are watching.
        const result =
          uploaderFor(rec) === 'door-log'
            ? await (await import('@/lib/doors/pitch-send')).sendPitchRecording(rec, {
                clientLabel: label,
              })
            : await uploadRecording(userId, rec, { clientLabel: label });
        await load();
        if (result.ok) {
          // Proof the server is taking uploads again, so automatic sending can
          // resume without waiting for a restart.
          clearAutoSendStop();
          const sessionId = result.sessionId;
          Alert.alert(
            'Sent',
            sessionId
              ? 'The call is on the server and is being transcribed now.'
              : // A pitch has no session to open. It joins Pitch Performance
                // once the coach has been through it, which is where a door rep
                // will look for it.
                'The pitch is on the server. It appears under Pitch Performance once it has been analysed.',
            sessionId
              ? [
                  { text: 'Stay here' },
                  {
                    text: 'Open it',
                    onPress: () =>
                      router.push({ pathname: '/(app)/[id]', params: { id: sessionId } }),
                  },
                ]
              : [{ text: 'Done' }],
          );
        } else {
          Alert.alert('Not sent', result.message);
        }
      } finally {
        setBusyId(null);
      }
    },
    [userId, labels, load, router],
  );

  /**
   * Flush everything that is ready, now.
   *
   * Automatic sending already covers named recordings, but only on its own
   * triggers and behind a cooldown — which is right for something running
   * unattended and wrong for a rep who has just walked back into signal and
   * wants them gone. `force` skips the cooldown; it deliberately does NOT
   * override the hard stop, because that means the server is refusing these and
   * no amount of asking changes it.
   *
   * Unnamed recordings are untouched, here as everywhere: naming one is how the
   * rep says it should go.
   */
  const sendAll = useCallback(async () => {
    if (!userId) return;
    setSendingAll(true);
    try {
      const result = await runAutoSend(userId, { force: true });
      await load();
      if (result.sent > 0) {
        Alert.alert(
          result.sent === 1 ? 'Sent' : `${result.sent} sent`,
          result.sent === 1
            ? 'The call is on the server and is being transcribed now.'
            : 'They are on the server and are being transcribed now.',
        );
      } else if (result.skipped && result.reason === 'stopped') {
        Alert.alert(
          'Not sent',
          'The server has been turning sends down. Everything stays safe on this phone.',
        );
      } else if (result.attempted > 0) {
        Alert.alert('Not sent', 'Nothing went through. They are all still here.');
      }
    } finally {
      setSendingAll(false);
    }
  }, [userId, load]);

  /**
   * Hand the audio file to the rep.
   *
   * WHY THIS EXISTS AT ALL. A recording is the only copy of a conversation, and
   * right now it cannot reach the server — so without this the rep's own work is
   * trapped on one phone with no way out. Sending it to Files, a message, or a
   * colleague is a route they control and can use today.
   *
   * It shares the ORIGINAL file rather than a copy: the audio itself, playable
   * anywhere. Nothing is deleted afterwards — having sent a copy somewhere is
   * not the same as the server having it, and the app must not act as if it is.
   */
  const saveCopy = useCallback(async (rec: PendingRecording) => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          'Not available',
          'This device cannot share files. The recording is still safe here.',
        );
        return;
      }
      await Sharing.shareAsync(rec.fileUri, {
        mimeType: rec.mimeType,
        dialogTitle: rec.label?.trim() || 'Call recording',
        UTI: 'public.mpeg-4-audio',
      });
    } catch (e) {
      Alert.alert(
        'Could not share it',
        e instanceof Error && e.message
          ? e.message
          : 'The recording is still here and nothing was lost.',
      );
    }
  }, []);

  const discard = useCallback(
    (rec: PendingRecording) => {
      Alert.alert(
        'Delete this recording?',
        `${spokenLength(rec.durationMs)} recorded on ${shortDate(rec.recordedAt)}. This is the only copy — it has not reached the server, and it cannot be recovered.

If you want to keep it, use "Save a copy" first.`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (!userId) return;
              deleteRecordingFile(rec.fileUri);
              await removeRecording(userId, rec.clientId);
              await load();
            },
          },
        ],
      );
    },
    [userId, load],
  );

  if (!rows) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['bottom']}>
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading your recordings" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.clientId}
        contentContainerClassName="grow px-5 pb-8"
        ListHeaderComponent={
          <View>
            {totalBytes > 0 ? (
              <Text className="mt-4 font-body text-sm text-muted-foreground">
                {rows?.filter((r) => r.status !== 'uploaded').length} on this phone, using{' '}
                {megabytes(totalBytes)}.
              </Text>
            ) : null}

            {/* Only when it saves real taps: with one recording the row's own
                Send button is right there. */}
            {readyToSend > 1 && !offline ? (
              <Pressable
                onPress={sendAll}
                disabled={sendingAll || busyId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Send all ${readyToSend} named recordings now`}
                accessibilityState={{ disabled: sendingAll, busy: sendingAll }}
                className="mt-4 min-h-7 flex-row items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 active:bg-primary-pressed disabled:opacity-50"
              >
                {sendingAll ? <ActivityIndicator color={C['primary-foreground']} /> : null}
                <Text className="font-strong text-base text-primary-foreground">
                  {sendingAll ? 'Sending' : `Send all ${readyToSend} now`}
                </Text>
              </Pressable>
            ) : null}
            {offline && rows.length > 0 ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mt-4 rounded-md border border-border-control px-3 py-3"
            >
              <Text className="font-strong text-base text-foreground">No connection</Text>
              <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                These stay exactly where they are until you have signal. Nothing
                expires and nothing is deleted on its own.
              </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-start justify-center gap-3">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Nothing waiting
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              Recordings appear here after you record a call, and stay until they
              have reached the server.
            </Text>
            <Pressable
              onPress={() => router.push('/(app)/record')}
              accessibilityRole="button"
              accessibilityLabel="Record a call"
              className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
            >
              <Text className="font-strong text-base text-primary-foreground">Record a call</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Row
            rec={item}
            label={labels[item.clientId] ?? item.label ?? ''}
            onLabel={(text) => setLabels((prev) => ({ ...prev, [item.clientId]: text }))}
            onLabelDone={(text) => saveLabel(item, text)}
            onContext={(patch) => saveContext(item, patch)}
            onOutcome={(patch) => saveOutcome(item, patch)}
            canPlay={focused}
            onSend={() => send(item)}
            onSaveCopy={() => saveCopy(item)}
            onDiscard={() => discard(item)}
            busy={busyId === item.clientId}
            disabled={offline || (busyId !== null && busyId !== item.clientId)}
          />
        )}
      />
    </SafeAreaView>
  );
}

/**
 * A labelled input. Every field on this screen gets a VISIBLE label and the same
 * words as its accessible name — a placeholder is never a label, because it
 * disappears the moment typing starts.
 *
 * React Native has no :focus-visible, so the focus ring is driven from the
 * control's own callbacks.
 */
function LabelledInput({
  label,
  hint,
  value,
  onChangeText,
  onDone,
  editable,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  onDone: (text: string) => void;
  editable: boolean;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mt-4">
      <Text className="font-emphasis text-sm text-muted-foreground">{label}</Text>
      {hint ? <Text className="mt-1 font-body text-xs text-muted-foreground">{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={C['muted-foreground']}
        returnKeyType="done"
        onSubmitEditing={() => onDone(value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onDone(value);
        }}
        className={`mt-2 min-h-7 rounded-md border px-3 py-3 font-body text-base text-foreground ${
          focused ? 'border-primary' : 'border-border-control'
        }`}
      />
    </View>
  );
}

function Row({
  rec,
  label,
  canPlay,
  onLabel,
  onLabelDone,
  onContext,
  onOutcome,
  onSend,
  onSaveCopy,
  onDiscard,
  busy,
  disabled,
}: {
  rec: PendingRecording;
  label: string;
  /** False while another screen is in front — every player is released. */
  canPlay: boolean;
  onLabel: (text: string) => void;
  onLabelDone: (text: string) => void;
  onContext: (patch: { territory?: string; approach?: string; offer?: string }) => void;
  onOutcome: (patch: { outcome?: SessionOutcome; dealValue?: string }) => void;
  onSend: () => void;
  onSaveCopy: () => void;
  onDiscard: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const [showContext, setShowContext] = useState(false);
  /** The player is created only once the rep asks to hear it. */
  const [listening, setListening] = useState(false);
  const [outcome, setOutcome] = useState<SessionOutcome | null>(rec.outcome);
  const [dealValue, setDealValue] = useState(
    rec.dealValue === null ? '' : String(rec.dealValue),
  );
  const [territory, setTerritory] = useState(rec.territory ?? '');
  const [approach, setApproach] = useState(rec.approach ?? '');
  const [offer, setOffer] = useState(rec.offer ?? '');
  // Checked at render: a file removed by the OS or by another path should be
  // visible as such rather than only failing when the rep presses send.
  const present = recordingFileExists(rec.fileUri);
  // Decided here rather than at send time. A recording the server will refuse is
  // the one thing this screen most needs to say out loud — a rep was otherwise
  // finding out by tapping Send, and could tap it forever.
  const canSend = sendability(rec.sizeBytes);

  return (
    <View className="mt-4 rounded-md border border-border-control p-4">
      <Text className="font-strong text-base text-foreground">
        {spokenLength(rec.durationMs)}
      </Text>
      <Text className="mt-1 font-body text-sm text-muted-foreground">
        {shortDate(rec.recordedAt)} at {clockTime(rec.recordedAt)} · {megabytes(rec.sizeBytes)}
      </Text>

      {!present ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-body text-sm leading-relaxed text-destructive"
        >
          The audio file is missing from this phone. There is nothing left to send.
        </Text>
      ) : null}

      {/* Only when the file IS still here: "missing" already says everything,
          and two alarms about one recording reads as two problems. */}
      {present && !canSend.sendable ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-body text-sm leading-relaxed text-destructive"
        >
          This recording is about {canSend.overMb} MB over what the server accepts, so it cannot
          be sent. The audio is still on this phone — play it back before you delete it.
        </Text>
      ) : null}

      {rec.lastError ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-body text-sm leading-relaxed text-muted-foreground"
        >
          {rec.lastError}
          {rec.attempts > 1 ? ` (tried ${rec.attempts} times)` : ''}
        </Text>
      ) : null}

      {/* Said plainly, because otherwise this recording simply stops being
          included in automatic sends and a rep goes on believing it is on its
          way. Sending by hand still works and always will — the cap is on
          unattended retries, not on the rep. */}
      {autoSendGaveUp(rec) ? (
        <Text
          accessibilityRole="alert"
          className="mt-2 font-body text-sm leading-relaxed text-foreground"
        >
          {/* "Send below" pointed at a control by position — meaningless to a
              screen-reader user swiping through controls, and wrong whenever the
              row reflows. The button's own label carries the sentence instead. */}
          This one is no longer being retried on its own. It is still here, and
          Send still works.
        </Text>
      ) : null}

      {/* Before the naming field, deliberately: hearing it is what tells a rep
          whether it is worth sending at all. Only when this build can play audio
          — the same native module the recorder needs.
          
          MOUNTED ONLY WHEN ASKED FOR. Every mounted player holds an audio
          session, so a screen of rows would open several at once for a rep who
          wanted to listen to none of them — wasteful, and on iOS a live player
          is exactly what makes the NEXT recording come out quiet. */}
      {present && RECORDING_AVAILABLE ? (
        listening && canPlay ? (
          <RecordingPlayer fileUri={rec.fileUri} />
        ) : (
          <Pressable
            onPress={() => setListening(true)}
            accessibilityRole="button"
            accessibilityLabel="Listen to this recording before sending it"
            className="mt-4 min-h-7 items-center justify-center rounded-md border border-border-control px-5 py-3 active:opacity-70"
          >
            <Text className="font-emphasis text-base text-foreground">Listen first</Text>
          </Pressable>
        )
      ) : null}

      {present ? (
        <View>
          <LabelledInput
            label="Who was this with?"
            hint="The name it will be filed under."
            value={label}
            onChangeText={onLabel}
            onDone={onLabelDone}
            editable={!busy}
            placeholder="Rowan & Co, the corner unit"
          />

          {/*
            WHAT HAPPENS IF THEY TYPE NOTHING, said out loud (REV 1, 2026-09-11).

            An unnamed recording now sends itself, which is the whole point of the change - but a
            name the rep never typed must not simply appear on their sessions list later with no
            explanation. This says what it will be, and by saying it invites a better one: "Rowan
            & Co, the corner unit" is findable in a month and "Door, 10 Sep at 4:53 PM" is not.

            Only while the field is empty. Once they type, the sentence has nothing to add.
          */}
          {isAutoTitled({ label }) ? (
            <Text className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
              Leave this blank and it is filed as{' '}
              <Text className="text-foreground">
                {autoTitle({ recordedAt: rec.recordedAt, kind: rec.kind })}
              </Text>
              . It still sends either way.
            </Text>
          ) : null}

          <OutcomePicker
            value={outcome}
            onChange={(next) => {
              setOutcome(next);
              onOutcome({ outcome: next });
            }}
            disabled={busy}
            hint="Without this the call is not counted in your numbers."
          />

          {outcome === 'sold' ? (
            <LabelledInput
              label="What was it worth?"
              hint="Dollars. Leave blank if you would rather not say."
              value={dealValue}
              onChangeText={setDealValue}
              onDone={(text) => onOutcome({ dealValue: text })}
              editable={!busy}
              placeholder="1500"
            />
          ) : null}

          {/* Collapsed by default, and it stays that way. These three fields are
              what the website asks for and what the numbers read, so a recorded
              call without them is thinner than one typed up later — but a rep in
              a van will not fill in a form, and a call filed with less detail
              beats a call that never gets sent. Offered, never required. */}
          <Pressable
            onPress={() => setShowContext((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showContext ? 'Hide the call details' : 'Add details about this call'}
            accessibilityState={{ expanded: showContext }}
            className="mt-3 min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-primary">
              {showContext ? 'Hide details' : 'Add details (optional)'}
            </Text>
          </Pressable>

          {showContext ? (
            <View>
              <LabelledInput
                label="Where"
                hint="The patch or area."
                value={territory}
                onChangeText={setTerritory}
                onDone={(text) => onContext({ territory: text })}
                editable={!busy}
                placeholder="Northside, Tuesday round"
              />
              <LabelledInput
                label="How"
                hint="How you opened."
                value={approach}
                onChangeText={setApproach}
                onDone={(text) => onContext({ approach: text })}
                editable={!busy}
                placeholder="Cold knock, referral from next door"
              />
              <LabelledInput
                label="What"
                hint="What you offered."
                value={offer}
                onChangeText={setOffer}
                onDone={(text) => onContext({ offer: text })}
                editable={!busy}
                placeholder="Annual plan with the install included"
              />
            </View>
          ) : null}

          <Pressable
            onPress={onSend}
            disabled={busy || disabled}
            accessibilityRole="button"
            accessibilityLabel="Send this recording"
            accessibilityState={{ disabled: busy || disabled }}
            className="mt-4 min-h-7 flex-row items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 active:bg-primary-pressed disabled:opacity-50"
          >
            {busy ? <ActivityIndicator color={C['primary-foreground']} /> : null}
            <Text className="font-strong text-base text-primary-foreground">
              {busy ? 'Sending' : 'Send'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Offered whether or not the file can be sent: a rep whose recording has
          failed repeatedly needs a way to get it off the phone MORE than one
          whose upload is working. */}
      {present ? (
        <Pressable
          onPress={onSaveCopy}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Save a copy of this recording somewhere else"
          accessibilityState={{ disabled: busy }}
          className="mt-3 min-h-7 items-center justify-center rounded-md border border-border-control px-5 py-3 active:opacity-70"
        >
          <Text className="font-emphasis text-base text-foreground">Save a copy</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onDiscard}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Delete this recording"
          accessibilityState={{ disabled: busy }}
        className="mt-3 min-h-7 items-center justify-center active:opacity-70"
      >
        <Text className="font-emphasis text-sm text-muted-foreground">Delete</Text>
      </Pressable>
    </View>
  );
}
