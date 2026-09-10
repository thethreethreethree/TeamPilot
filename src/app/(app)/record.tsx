/**
 * Recording a call.
 *
 * THE PROMISE THIS SCREEN MAKES. A rep is about to point their phone at a real
 * conversation with a real customer. They need to know, without reading
 * anything, whether it is recording. So the state is carried by words and a
 * running clock, not by a colour or a pulse — a red dot means nothing to someone
 * who cannot see it, and an animation means nothing under Reduce Motion.
 *
 * PERMISSION DENIAL IS A REAL PATH, NOT AN ERROR. A rep who said no once, or
 * whose company profile disallows the microphone, will hit this screen. The
 * denied state explains what is unavailable and how to change it, and the rest
 * of the app keeps working. It never re-prompts in a loop; iOS only shows the
 * system prompt once, so a second request returns "denied" without asking, and
 * pretending otherwise would leave a rep tapping a button that cannot work.
 *
 * NOTHING IS UPLOADED FROM HERE. The file is moved somewhere durable and
 * recorded on the device the moment recording stops. Sending it to the server is
 * a separate step that can fail, retry, and wait for signal — because it will.
 * A recording cannot be re-taken, so it is made safe before it is made useful.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { useMacroMode } from '@/lib/doors/macro-context';
import { PITCH_OUTCOMES, type PitchOutcome } from '@/lib/doors/pitch-outcome';
import { localDate } from '@/lib/doors/knock-store';
import { audio, RECORDING_AVAILABLE } from '@/lib/audio/module';

import { useAuth } from '@/lib/auth-context';
import { CALL_RECORDING_OPTIONS } from '@/lib/audio/recording-options';
import { CALL_AUDIO_MODE, RELEASED_AUDIO_MODE } from '@/lib/audio/audio-modes';
import {
  partLabel,
  pitchCeilingText,
  shouldSplit,
  shouldWarnOfSplit,
  splitNoticeText,
  splitWarningText,
} from '@/lib/audio/recording-split';
import {
  MAX_RECORDING_SECONDS,
  diskSpaceForRecording,
  persistRecording,
} from '@/lib/audio/capture';
import { countPending, pendingBytes } from '@/lib/audio/recording-store';
import { markRecordingStarted, clearRecordingStarted } from '@/lib/audio/in-flight';
import { cachedDetailBytes, clearAllCachedDetails } from '@/lib/sync/session-detail-cache';
import { autoSendStopped } from '@/lib/audio/auto-send';
import { C } from '@/lib/theme';
import { humanError } from '@/lib/error-message';

type Permission = 'unknown' | 'granted' | 'denied';

/** mm:ss, or h:mm:ss once a call runs past an hour. */
function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export default function RecordScreen() {
  // The branch happens ABOVE any hook, because a hook cannot be called
  // conditionally and the recorder's hooks do not exist in a client without the
  // native module. Mounting a different component is the only correct shape.
  if (!RECORDING_AVAILABLE) return <RecordingUnavailable />;
  return <Recorder />;
}

/**
 * Shown when this client has no recorder — Expo Go without the module, most
 * likely. It explains rather than crashes, and says plainly that the rest of the
 * app is unaffected, because a rep who hits this should not conclude the app is
 * broken.
 */
/**
 * Where a rep goes when recording cannot happen here.
 *
 * "Your sessions" is the right offer in the standard product and the WRONG one
 * in Macro Mode, where Sessions is not in the tab bar at all — a door rep would
 * be handed a screen that is not part of their app, with their own working
 * surface nowhere in sight. `enabled` is null until it is known; only a definite
 * true diverts, so an unread mode behaves as the standard product rather than
 * guessing.
 */
function useRecordEscape(): { to: '/(app)/doors' | '/(app)/(tabs)/sessions'; label: string; spoken: string } {
  const macro = useMacroMode().enabled === true;
  return macro
    ? { to: '/(app)/doors', label: 'Door Log', spoken: 'Go to your door log' }
    : { to: '/(app)/(tabs)/sessions', label: 'Your sessions', spoken: 'Go to your sessions' };
}

function RecordingUnavailable() {
  const escape = useRecordEscape();
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-background px-5" edges={['bottom']}>
      <View className="flex-1 items-start justify-center gap-3">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          Recording is not in this build
        </Text>
        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          Recording needs a part of the app that is not included in this version.
          Everything else — your sessions, the coach, your numbers — works normally.
        </Text>
        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          Installing the full build turns it on. Nothing you have recorded before
          is affected.
        </Text>
        <Pressable
          onPress={() => router.replace(escape.to)}
          accessibilityRole="button"
          accessibilityLabel={escape.spoken}
          className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
        >
          <Text className="font-strong text-base text-primary-foreground">{escape.label}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Recorder() {
  const escape = useRecordEscape();
  /**
   * A DOOR PITCH, arriving from the Door Log's "Record this pitch".
   *
   * The two pipelines diverge here and nowhere else in this screen: a pitch is
   * posted to the door-log route (creating a knock AND a pitch, so it counts
   * toward doors knocked and appears in Pitch Performance), a session becomes a
   * coaching session. Everything about the RECORDING is identical.
   */
  const { pitch: pitchParam } = useLocalSearchParams<{ pitch?: string }>();
  const isPitch = pitchParam === '1';
  /** Set once a pitch has stopped and is waiting for its outcome. */
  const [pendingPitch, setPendingPitch] = useState<{ uri: string; durationMs: number } | null>(
    null,
  );
  const [savingPitch, setSavingPitch] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const recorder = audio!.useAudioRecorder(CALL_RECORDING_OPTIONS);
  // Polled rather than pushed, at a rate a human reads a clock at. A per-frame
  // update would spend battery during the one activity where the phone is in a
  // pocket and cannot be charged.
  const state = audio!.useAudioRecorderState(recorder, 500);

  const [permission, setPermission] = useState<Permission>('unknown');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [pendingSize, setPendingSize] = useState(0);
  /** Saved transcripts. Separate from recordings because the ADVICE differs:
   *  these can be downloaded again, and recordings cannot. */
  const [cacheSize, setCacheSize] = useState(0);
  const startedAt = useRef<number | null>(null);
  /**
   * Which part of a long call is being recorded, counting from 1.
   *
   * A REF RATHER THAN STATE, and deliberately: the split runs inside an effect
   * that reads it and writes it in the same tick, and a state value would still
   * hold the previous number when the second part is labelled. It is never
   * rendered, so nothing needs a re-render when it changes.
   */
  const part = useRef(1);
  /** True while a part is being closed and the next started. Guards re-entry. */
  const splitting = useRef(false);
  /** So the five-minute warning is said once, not on every poll. */
  const warnedOfSplit = useRef(false);
  /** What the rep is told about a split. Separate from `error`: nothing failed. */
  const [splitNote, setSplitNote] = useState<string | null>(null);
  /** `stop` is defined below this listener; a ref keeps the listener honest
   *  without shuffling the file to satisfy declaration order. */
  const stopRef = useRef<() => Promise<void>>(async () => {});

  /**
   * Hand the audio session back when this screen goes away.
   *
   * Leaving mid-recording is intercepted and asks first, so by the time this
   * runs the recorder is stopped or the rep chose to discard. Either way the app
   * should not still own the microphone and the background-audio slot: holding
   * them affects other apps and the next recording, and nothing on any screen
   * would explain why.
   *
   * Deliberately not dependent on component state — it must run however the
   * screen was left, including after an error.
   */
  useEffect(() => {
    return () => {
      audio?.setAudioModeAsync(RELEASED_AUDIO_MODE).catch(() => {
        // Nothing left to report to; the screen is gone.
      });
    };
  }, []);

  const refreshPending = useCallback(async () => {
    if (!userId) return;
    setPending(await countPending(userId));
    setPendingSize(await pendingBytes(userId));
    setCacheSize(cachedDetailBytes(userId));
  }, [userId]);

  // useFocusEffect, not useEffect: this is what every other loading screen in
  // the app uses, and setState inside a bare mount effect triggers the
  // cascading render React warns about. Returning to the screen also gets
  // fresh figures rather than whatever was true when it first mounted.
  useFocusEffect(
    useCallback(() => {
      refreshPending();
    }, [refreshPending]),
  );

  // Ask what we already have before asking the OS to prompt. A rep who granted
  // this last week should not see a prompt, and one who refused should not be
  // asked again by an app that did not check.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await audio!.getRecordingPermissionsAsync();
        if (cancelled) return;
        setPermission(existing.granted ? 'granted' : existing.canAskAgain ? 'unknown' : 'denied');
      } catch {
        if (!cancelled) setPermission('unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Returning from Settings should not require a relaunch to notice that the
  // microphone was just switched on.
  //
  // This also catches an INTERRUPTION. An incoming phone call takes the
  // microphone, and iOS does not hand it back — the recorder stops while the app
  // is in the background. Coming back to a running clock that is no longer
  // recording would be the app lying about the one thing it must not lie about,
  // so the rep is told, and whatever was captured before the interruption is
  // still on the phone to save.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      try {
        const existing = await audio!.getRecordingPermissionsAsync();
        setPermission(existing.granted ? 'granted' : existing.canAskAgain ? 'unknown' : 'denied');
      } catch {
        /* leave the current state alone */
      }
      if (startedAt.current !== null && !recorder.isRecording) {
        setError(
          'Recording stopped while the app was in the background — most likely a phone call took the microphone. What was captured up to that point is still here: press Stop and save to keep it.',
        );
      }
    });
    return () => sub.remove();
  }, [recorder, userId]);

  /**
   * Leaving this screen while it is recording destroys the recording.
   *
   * The screen owns the recorder, so popping it releases the recorder and the
   * conversation captured so far goes with it — silently, with no error and
   * nothing saved. A back gesture is easy to make by accident with one hand, and
   * a rep would have no way of knowing what had just happened.
   *
   * So leaving is intercepted while recording, and the choice is stated in terms
   * of what is actually lost. "Stop and save" is offered first because it is
   * almost always what they meant.
   */
  const navigation = useNavigation();
  useEffect(() => {
    if (!state.isRecording) return;
    const sub = navigation.addListener('beforeRemove', (event: { preventDefault: () => void }) => {
      event.preventDefault();
      Alert.alert(
        'Still recording',
        'Leaving now throws away this recording. It has not been saved yet.',
        [
          {
            text: 'Stop and save',
            onPress: async () => {
              await stopRef.current();
              navigation.dispatch((event as unknown as { data: { action: never } }).data.action);
            },
          },
          { text: 'Keep recording', style: 'cancel' },
          {
            text: 'Throw it away',
            style: 'destructive',
            onPress: () =>
              navigation.dispatch((event as unknown as { data: { action: never } }).data.action),
          },
        ],
      );
    });
    return sub;
  }, [navigation, state.isRecording]);

  const start = useCallback(async () => {
    setError(null);

    // Checked BEFORE the conversation, because it is the only moment anything
    // can be done about it. A warning rather than a refusal: a rep with room for
    // eleven minutes and a five-minute pitch to record should not be stopped by
    // us, they should be told.
    const disk = diskSpaceForRecording();
    if (!disk.ok) {
      // Naming what this app is holding, when it is holding anything. "Free some
      // space" is not advice a rep can act on at a door; "your 6 saved
      // recordings are using 142 MB" is.
      const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(0);

      // Two different pieces of advice, because the two are not alike. A
      // recording is the only copy of a conversation and must not be deleted to
      // make room; a saved transcript can be downloaded again and is the right
      // thing to clear first. Lumping them together as "this app is using
      // 300 MB" would push a rep toward deleting the irreplaceable half.
      const ours =
        pendingSize > 0
          ? ` Your ${pending} saved ${pending === 1 ? 'recording is' : 'recordings are'} using ${mb(
              pendingSize,
            )} MB — sending ${pending === 1 ? 'it' : 'them'} frees that.`
          : '';
      const saved =
        cacheSize > 1024 * 1024
          ? ` Saved transcripts are using another ${mb(cacheSize)} MB and can be downloaded again.`
          : '';

      setError(
        (disk.minutesAvailable !== null && disk.minutesAvailable > 0
          ? `This phone is nearly full — about ${disk.minutesAvailable} ${
              disk.minutesAvailable === 1 ? 'minute' : 'minutes'
            } of recording will fit.`
          : 'This phone has no room left for a recording.') +
          ours +
          saved,
      );
      if (disk.minutesAvailable !== null && disk.minutesAvailable <= 0) return;
    }

    try {
      const granted = await audio!.requestRecordingPermissionsAsync();
      if (!granted.granted) {
        setPermission(granted.canAskAgain ? 'unknown' : 'denied');
        if (granted.canAskAgain) {
          setError('The microphone is needed to record a call.');
        }
        return;
      }
      setPermission('granted');

      // Without this iOS records at a low level, or refuses while another app
      // holds the audio session. It is set at start rather than on mount so the
      // app does not take the audio session for a screen the rep only opened.
      //
      // `allowsBackgroundRecording` IS THE ONE THAT KEEPS A CALL RECORDING, and
      // this used to set only `shouldPlayInBackground` while a comment right here
      // claimed that was the one that mattered. It is not, and the difference is
      // the whole bug the founder reported: switch to another app mid-call and
      // the recording stopped.
      //
      // The two flags guard different things, and expo-audio's own
      // `AudioModule.swift` says so plainly:
      //
      //     OnAppEntersBackground {
      //       if !shouldPlayInBackground   { pauseAllPlayers() }
      //       if !allowsBackgroundRecording { pauseAllRecorders() }
      //     }
      //
      // `allowsBackgroundRecording` defaults to FALSE, so the module was pausing
      // the recorder itself the instant the app went to the background. No error
      // was raised and nothing was lost from before that moment — the rep simply
      // came back to a recording that had stopped without being asked to.
      //
      // Both halves are still needed and neither is sufficient alone:
      //   UIBackgroundModes: ["audio"]   in app.json  - iOS lets the app run at all
      //   allowsBackgroundRecording      here         - expo-audio leaves the recorder alone
      //
      // ANDROID IS NOT SOLVED BY THIS. The flag is accepted there, but Android
      // needs a foreground service to keep a microphone open in the background.
      // This app has never been compiled for Android; that is the piece to build
      // when it is, and it is a real gap rather than an oversight.
      await audio!.setAudioModeAsync(CALL_AUDIO_MODE);

      await recorder.prepareToRecordAsync();
      startedAt.current = Date.now();
      recorder.record();
      // A fresh call is part one again. Without this the second call of the day
      // would carry on numbering from wherever the first one stopped.
      part.current = 1;
      warnedOfSplit.current = false;
      setSplitNote(null);

      // Written AFTER record() has been called, because only then does the
      // recorder have a uri to write down, and before anything else, because
      // every second from here to Stop is a second the app could be killed in.
      // The marker is the only thing that would know a call had begun.
      if (recorder.uri) {
        await markRecordingStarted({
          uri: recorder.uri,
          startedAt: new Date().toISOString(),
          userId,
          label: null,
        });
      }
    } catch (e) {
      // The audio mode may already have been taken before the failure. Handing
      // it back matters: leaving it held keeps this app owning the microphone
      // and the background audio slot for a recording that never began, which
      // other apps — and the next attempt — would feel and nothing would explain.
      await audio!.setAudioModeAsync(RELEASED_AUDIO_MODE).catch(() => {});
      startedAt.current = null;
      setError(
        humanError(
          e,
          'Could not start recording. Close any other app using the microphone and try again.',
        ),
      );
    }
    // Every value this reads is listed, and none of them is decoration:
    // `userId` is stamped onto the in-flight recovery marker, so a stale one
    // would attribute a recording to the rep who used this phone BEFORE the
    // current one; and pending/pendingSize/cacheSize are quoted as real
    // megabytes in the out-of-space message, where a stale figure tells someone
    // that sending their recordings frees an amount that is not true.
  }, [recorder, userId, pending, pendingSize, cacheSize]);

  /**
   * Close the current part and carry straight on in the next one.
   *
   * WHY IT DOES NOT GO THROUGH `stop()`. Stop releases the audio session, clears
   * the recovery marker and puts an alert on screen, all of which are right when
   * a call has ENDED and all of which are wrong here: the conversation is still
   * happening, and handing the session back for even a moment would drop the
   * microphone and the background slot mid-sentence.
   *
   * THE ORDER IS THE POINT. The part is persisted BEFORE the next one starts, so
   * a crash between the two loses at most the join rather than the part that was
   * already recorded. The recovery marker is re-stamped straight after the new
   * recorder has a uri, because from that instant it is the only thing that knows
   * a call is in progress.
   */
  const splitPart = useCallback(async () => {
    if (splitting.current) return;
    splitting.current = true;
    const finished = part.current;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = startedAt.current ? Date.now() - startedAt.current : 0;
      if (!uri) throw new Error('The recorder produced no file.');

      // Named, because automatic sending only ever touches a recording that has
      // a name and the rep did not ask for this one to exist.
      await persistRecording({
        userId,
        sourceUri: uri,
        durationMs,
        label: partLabel(finished),
      });

      // Straight back on. The audio mode is deliberately NOT re-set: it is still
      // held from the start of the call, and releasing it here is what would
      // drop the recording.
      await recorder.prepareToRecordAsync();
      startedAt.current = Date.now();
      recorder.record();
      part.current = finished + 1;
      warnedOfSplit.current = false;
      if (recorder.uri) {
        await markRecordingStarted({
          uri: recorder.uri,
          startedAt: new Date().toISOString(),
          userId,
          label: null,
        });
      }
      setSplitNote(splitNoticeText(finished));
      await refreshPending();
    } catch (e) {
      // The part may or may not have been saved; either way the app is no longer
      // recording, and saying so is the only honest thing left. The rep can press
      // Stop, which will save whatever the recorder still holds.
      startedAt.current = null;
      setError(
        humanError(
          e,
          'The call could not be continued in a new part. Press Stop to save what has been recorded.',
        ),
      );
    } finally {
      splitting.current = false;
    }
  }, [recorder, userId, refreshPending]);

  const stop = useCallback(async () => {
    if (!state.isRecording && !state.canRecord) return;
    setSaving(true);
    setError(null);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = startedAt.current ? Date.now() - startedAt.current : 0;
      startedAt.current = null;

      // Release the audio session so other apps (and the coach) behave normally.
      await audio!.setAudioModeAsync(RELEASED_AUDIO_MODE).catch(() => {});

      if (!uri) throw new Error('The recorder produced no file. Nothing was saved.');

      // Deliberately NOT gated on being signed in. A session can expire during a
      // conversation, and refusing to save at that moment would destroy the one
      // thing here that cannot be recreated. It is saved unattached and picked
      // up at the next sign-in.
      if (isPitch) {
        // Held until the rep says how it went. Persisting happens inside the
        // prompt so the outcome travels WITH the audio into the durable store —
        // a pitch saved now and asked about later, after forty more doors, gets
        // a worse answer than one asked about while they are still standing there.
        setPendingPitch({ uri, durationMs });
        await clearRecordingStarted();
        return;
      }
      await persistRecording({ userId, sourceUri: uri, durationMs });
      // Only now: the call stopped cleanly and the file is in the store, so
      // there is nothing left to recover. Cleared AFTER the persist rather than
      // before, so a failure in between still leaves the marker behind and the
      // next launch picks the call up.
      await clearRecordingStarted();
      await refreshPending();

      // Said with an alert rather than a toast because it is the one moment the
      // rep needs certainty: the call is on the phone and will not be lost.
      //
      // AND IT OFFERS THE NAME. Automatic sending only touches a recording that
      // has one, and naming only happens on the recordings screen — so without
      // this prompt a rep who never goes there ends up with a phone full of
      // calls that will never send, by a rule they were never told about. The
      // offer closes that loop at the only moment they are certainly thinking
      // about the conversation they just had.
      Alert.alert(
        'Saved on this phone',
        userId
          ? // The second sentence is a promise, so it is only made when it holds.
            // If the server is refusing uploads, "it sends itself as soon as you
            // have a bar" is simply untrue, and a rep would come back later to
            // find it still sitting there.
            `${clock(durationMs / 1000)} recorded. It stays here until it has been sent — you can walk away from signal without losing it.` +
            (autoSendStopped()
              ? '\n\nThe server turned the last send down, so it is being held here safely.'
              : '\n\nName it now and it sends itself as soon as you have a bar.')
          : `${clock(durationMs / 1000)} recorded and saved. You are signed out, so it is being held on this phone — sign in and it will be waiting.`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Name it now', onPress: () => router.push('/(app)/recordings') },
        ],
      );
    } catch (e) {
      setError(
        humanError(e, 'The recording could not be saved. Do not close the app — try stopping again.'),
      );
    } finally {
      setSaving(false);
    }
  }, [recorder, state.isRecording, state.canRecord, userId, refreshPending, router, isPitch]);

  // Assigned in an effect, not during render. Writing to a ref while rendering
  // is an impure render: React may render a component twice (it does, in
  // development and under concurrent rendering) and a render that mutates
  // something outside itself is not safe to repeat. The listener that reads this
  // is itself registered in an effect, so it can never fire before this runs.
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  /**
   * Save the pitch with the outcome the rep just chose.
   *
   * The audio is moved into the durable store HERE rather than at stop, so the
   * outcome and the rep's own local date travel with it. If this throws the
   * recording is not lost — the file is still where the recorder left it and
   * the screen stays on this question rather than dropping the rep somewhere
   * else with nothing to show for the conversation.
   */
  const savePitch = useCallback(
    async (outcome: PitchOutcome) => {
      if (!pendingPitch || savingPitch) return;
      setSavingPitch(true);
      setError(null);
      try {
        await persistRecording({
          userId,
          sourceUri: pendingPitch.uri,
          durationMs: pendingPitch.durationMs,
          pitch: { outcome, localDate: localDate() },
        });
        await refreshPending();
        setPendingPitch(null);
        Alert.alert(
          'Pitch saved',
          'It is on this phone and sends itself when you have signal. It appears under Pitch Performance once the coach has been through it.',
          [{ text: 'Back to the doors', onPress: () => router.replace('/(app)/doors') }],
        );
      } catch (e) {
        setError(
          humanError(e, 'That could not be saved. Try choosing the outcome again.'),
        );
      } finally {
        setSavingPitch(false);
      }
    },
    [pendingPitch, savingPitch, userId, refreshPending, router],
  );

  const elapsed = state.durationMillis ? state.durationMillis / 1000 : 0;
  const remaining = MAX_RECORDING_SECONDS - elapsed;

  /**
   * Watch the clock and cut the call into parts before it becomes unsendable.
   *
   * WHY A CALL IS CUT AT ALL. The server refuses an upload over 25 MB, about a
   * hundred minutes of this app's speech settings. A recording that runs past it
   * is not degraded, it is REFUSED — the audio survives on the phone and can
   * never be transcribed or coached. Background recording, now that it works,
   * makes running past it far easier: the phone is in a pocket and the clock is
   * genuinely still going.
   *
   * A DOOR PITCH IS STOPPED, NOT SPLIT. A doorstep pitch past an hour and a half
   * is not a pitch, and a second part would be recording something the outcome
   * prompt has no question for. It takes the ordinary Stop path, which saves it
   * and asks how it went.
   *
   * THE WARNING COMES FIRST because this app has never ended a recording on its
   * own, and doing that with no warning is indistinguishable from it breaking.
   */
  useEffect(() => {
    if (!state.isRecording) return;
    /*
     * A TIMER READING THE RECORDER, not an effect reading render state.
     *
     * The recorder's own `currentTime` is the length of the FILE, which is what
     * the server's ceiling is actually about - a render-derived value would be
     * one poll behind and, worse, acting on it in an effect body is setState in
     * an effect, which cascades renders and which this repo's lint refuses.
     * Ticking a clock and acting in the CALLBACK is what a subscription to an
     * external system looks like, and the recorder is exactly that.
     *
     * Ten seconds is fine: the split has two minutes of headroom below the
     * ceiling, so a tick's worth of lateness costs nothing, and a rep in a long
     * appointment does not need a per-second poll running in their pocket.
     */
    const tick = setInterval(() => {
      if (!recorder.isRecording) return;
      const seconds = recorder.currentTime;
      if (shouldWarnOfSplit(seconds) && !warnedOfSplit.current) {
        warnedOfSplit.current = true;
        if (!isPitch) setSplitNote(splitWarningText());
        return;
      }
      if (!shouldSplit(seconds)) return;
      if (isPitch) {
        setSplitNote(pitchCeilingText());
        void stopRef.current();
        return;
      }
      void splitPart();
    }, 10_000);
    return () => clearInterval(tick);
  }, [state.isRecording, isPitch, recorder, splitPart]);

  /**
   * A pitch has stopped and is waiting for its outcome.
   *
   * FOUR OUTCOMES, NOT THE DOOR LOG'S FIVE: somebody opened the door and the rep
   * talked to them, so "no answer" cannot apply — and the server would reject
   * it, after the conversation, with audio that cannot be re-taken.
   *
   * There is deliberately no way past this screen without answering. The audio
   * is already stopped and safe on the device the moment it is saved, but a
   * pitch WITHOUT an outcome cannot be sent at all — so letting a rep walk away
   * here would leave them a recording that silently never goes anywhere.
   */
  if (pendingPitch) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5" edges={['bottom']}>
        <View className="flex-1 justify-center gap-3">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            How did it go?
          </Text>
          <Text className="font-body text-base leading-relaxed text-muted-foreground">
            {clock(pendingPitch.durationMs / 1000)} recorded. Choose how the door ended and it is
            saved with the pitch — it sends itself when you have signal.
          </Text>
          {error ? (
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="font-body text-base leading-relaxed text-destructive"
            >
              {error}
            </Text>
          ) : null}
          <View className="mt-2 gap-3">
            {PITCH_OUTCOMES.map((o) => (
              <Pressable
                key={o.outcome}
                disabled={savingPitch}
                onPress={() => void savePitch(o.outcome)}
                accessibilityRole="button"
                accessibilityState={{ disabled: savingPitch }}
                accessibilityLabel={`${o.label}. Saves this pitch.`}
                className={`min-h-9 items-center justify-center rounded-lg border px-5 py-5 active:bg-surface disabled:opacity-50 ${
                  o.lead ? 'border-primary' : 'border-border-control'
                }`}
              >
                <Text
                  className={`font-strong text-lg ${o.lead ? 'text-primary' : 'text-foreground'}`}
                >
                  {savingPitch ? 'Saving…' : o.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (permission === 'denied') {
    return (
      <SafeAreaView className="flex-1 bg-background px-5" edges={['bottom']}>
        <View className="flex-1 items-start justify-center gap-3">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            The microphone is switched off
          </Text>
          <Text className="font-body text-base leading-relaxed text-muted-foreground">
            Recording needs access to the microphone, and this phone has it turned
            off for Elostate. You can turn it on in Settings; everything else in the
            app works either way.
          </Text>
          <Pressable
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
          >
            <Text className="font-strong text-base text-primary-foreground">Open Settings</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace(escape.to)}
            accessibilityRole="button"
            accessibilityLabel={escape.spoken}
            className="min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-base text-primary">{escape.label}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="grow px-5 pb-8">
        <View className="grow items-center justify-center gap-2">
          {/* The clock IS the recording indicator. It reads correctly to a screen
              reader, in bright sun, and under Reduce Motion — none of which is
              true of a pulsing dot. */}
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLabel={
              state.isRecording
                ? `Recording. ${clock(elapsed)} so far.`
                : 'Not recording.'
            }
            className="font-heading text-6xl tabular-nums text-foreground"
          >
            {clock(elapsed)}
          </Text>

          <Text className="font-emphasis text-base text-muted-foreground">
            {state.isRecording ? 'Recording' : 'Ready to record'}
          </Text>

          {splitNote ? (
            <Text
              accessibilityLiveRegion="polite"
              className="mt-2 text-center font-body text-sm leading-relaxed text-muted-foreground"
            >
              {splitNote}
            </Text>
          ) : null}

          {state.isRecording && remaining < 300 ? (
            <Text
              accessibilityRole="alert"
              className="mt-2 text-center font-body text-sm leading-relaxed text-muted-foreground"
            >
              About {clock(remaining)} of recording room left. Stop before then and
              the call is kept in full.
            </Text>
          ) : null}
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            className="mb-4 rounded-md border border-destructive px-3 py-3"
          >
            <Text className="font-body text-sm leading-relaxed text-destructive">{error}</Text>
          </View>
        ) : null}

        {error && cacheSize > 1024 * 1024 ? (
          <Pressable
            onPress={() => {
              Alert.alert(
                'Clear saved transcripts?',
                `This frees about ${(cacheSize / 1024 / 1024).toFixed(0)} MB. Your recordings are not touched — only the copies kept for reading offline, which download again when you open a call with signal.`,
                [
                  { text: 'Keep them', style: 'cancel' },
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                      if (!userId) return;
                      await clearAllCachedDetails(userId);
                      await refreshPending();
                      setError(null);
                    },
                  },
                ],
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear saved transcripts to free space"
            className="mb-3 min-h-7 justify-center rounded-md border border-border-control px-4 py-3 active:opacity-70"
          >
            <Text className="font-emphasis text-base text-foreground">
              Clear saved transcripts
            </Text>
          </Pressable>
        ) : null}

        {pending > 0 ? (
          <Pressable
            onPress={() => router.push('/(app)/recordings')}
            accessibilityRole="button"
            accessibilityLabel={`${pending} ${pending === 1 ? 'recording' : 'recordings'} waiting to be sent`}
            className="mb-3 min-h-7 justify-center rounded-md border border-border-control px-4 py-3 active:opacity-70"
          >
            <Text className="font-emphasis text-base text-foreground">
              {pending} {pending === 1 ? 'recording' : 'recordings'} waiting to be sent
            </Text>
          </Pressable>
        ) : null}

        {/* One primary action, and it changes what it says rather than sitting
            beside a second button the rep has to choose between mid-call. */}
        {state.isRecording ? (
          <Pressable
            onPress={stop}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Stop recording and save"
            // busy, not only disabled: this control is the one doing the work, and
            // "dimmed" alone tells a screen-reader user nothing is happening.
            accessibilityState={{ disabled: saving, busy: saving }}
            className="min-h-7 flex-row items-center justify-center gap-2 rounded-md bg-primary px-5 py-4 active:bg-primary-pressed disabled:opacity-50"
          >
            {saving ? <ActivityIndicator color={C['primary-foreground']} /> : null}
            <Text className="font-strong text-base text-primary-foreground">
              {saving ? 'Saving' : 'Stop and save'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={start}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Start recording this call"
            accessibilityState={{ disabled: saving }}
            className="min-h-7 items-center justify-center rounded-md bg-primary px-5 py-4 active:bg-primary-pressed disabled:opacity-50"
          >
            <Text className="font-strong text-base text-primary-foreground">Start recording</Text>
          </Pressable>
        )}

        <Text className="mt-4 text-center font-body text-xs leading-relaxed text-muted-foreground">
          Recording stays on this phone until it is sent, so you can record with no
          signal. Up to {Math.floor(MAX_RECORDING_SECONDS / 60)} minutes per call.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
