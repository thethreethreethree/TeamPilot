/**
 * Voice enrollment — a one-time read that stores one number.
 *
 * WHAT IT IS FOR, said plainly on the screen because a rep is being asked to
 * record their own voice and deserves the reason: the app measures the pitch of
 * their speaking voice so it can tell their side of a call from the customer's.
 * What is kept is a single number in Hz. The recording is deleted from the phone
 * as soon as that number is worked out, before anything touches the network —
 * `enroll-flow.ts` holds that order and a test pins it.
 *
 * THE PROMISE IS ON THE SCREEN WHERE THE DECISION IS MADE, not in a settings
 * page nobody opens. A rep decides whether to record by reading the thing right
 * above the button.
 *
 * SOFT, NOT BLOCKING. Doc 05's rollout is "prompt now, hard-enforce after
 * verified on a real device". Nothing here gates a session start, and nothing
 * else in the app refuses to work because a rep has not enrolled. That stays
 * true until the capture flow has actually been run on hardware.
 *
 * NO LIVE FRAME COUNTER, and the reason is worth writing down rather than hiding.
 * The web counts voiced frames as the rep speaks because Web Audio hands it the
 * microphone frame by frame. React Native has no equivalent without a new native
 * module, and a native plugin has already cost this project a build. So the take
 * is recorded to a short uncompressed file and measured after it stops. The rep
 * sees the count afterwards instead, and is asked for another take when it is
 * short.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { audio } from '@/lib/audio/module';
import { ENROLL_AUDIO_MODE, RELEASED_AUDIO_MODE } from '@/lib/audio/audio-modes';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';
import { ENROLL_PRIVACY, ENROLL_PROMPT, takeProblemText } from '@/lib/voice/enrollment';
import { enrollFromRecording } from '@/lib/voice/enroll-flow';
import { REAL_ENROLL_DEPS } from '@/lib/voice/enroll-flow-deps';
import {
  ENROLL_DURATION_MS,
  ENROLL_RECORDING_OPTIONS,
} from '@/lib/voice/enroll-recording-options';
import {
  ENROLL_UNAVAILABLE_BODY,
  ENROLL_UNAVAILABLE_TITLE,
  fetchEnrollment,
  type EnrollmentStatus,
} from '@/lib/voice/enrollment-api';
import { wavProblemText } from '@/lib/voice/wav';

type Phase = 'loading' | 'ready' | 'recording' | 'working' | 'unavailable' | 'error';

export default function VoiceEnrollmentScreen() {
  const router = useRouter();
  const online = useOnline();

  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<EnrollmentStatus>({ enrolled: false, f0Hz: null });
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // The recorder is only reachable on a real build; `audio` is null in Expo Go
  // without the native module, and the screen says so rather than crashing.
  const recorder = audio?.useAudioRecorder(ENROLL_RECORDING_OPTIONS) ?? null;
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const result = await fetchEnrollment();
    if (result.ok) {
      setStatus(result.status);
      setPhase('ready');
      return;
    }
    setPhase('error');
    setMessage(
      result.reason === 'needs-shim' && result.why === 'signed-out'
        ? authFailureMessage('signed-out')
        : reachError(null, online, 'your voice enrollment'),
    );
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A screen left mid-take must not keep a timer alive that stops a recorder
  // nobody is watching any more.
  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    [],
  );

  const finish = useCallback(async () => {
    if (!recorder) return;
    setPhase('working');
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri ?? null;
      await audio?.setAudioModeAsync(RELEASED_AUDIO_MODE).catch(() => {});
    } catch {
      // Fall through: a stop that threw still may have left a file.
      uri = recorder.uri ?? null;
    }
    if (!uri) {
      setPhase('ready');
      setNote('The recorder produced no file. Try again.');
      return;
    }

    const out = await enrollFromRecording(uri, REAL_ENROLL_DEPS);
    switch (out.kind) {
      case 'enrolled':
        setStatus({ enrolled: true, f0Hz: out.f0Hz });
        setPhase('ready');
        setNote(`Saved. ${out.voicedFrames} frames of your voice were measured.`);
        return;
      case 'take-refused':
        setPhase('ready');
        setNote(takeProblemText(out.problem));
        return;
      case 'unreadable':
        setPhase('ready');
        setNote(wavProblemText(out.problem));
        return;
      case 'unavailable':
        setPhase('unavailable');
        return;
      case 'needs-shim':
        setPhase('error');
        setMessage(authFailureMessage('signed-out'));
        return;
      default:
        setPhase('ready');
        setNote(out.message ?? reachError(null, online, 'the server'));
    }
  }, [online, recorder]);

  const start = useCallback(async () => {
    if (!recorder || !audio) return;
    setNote(null);
    setMessage(null);
    try {
      const granted = await audio.requestRecordingPermissionsAsync();
      if (!granted.granted) {
        setNote(
          'The app needs permission to use the microphone before it can measure your voice. You can turn it on in Settings.',
        );
        return;
      }
      await audio.setAudioModeAsync(ENROLL_AUDIO_MODE);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
      // Stops itself: a rep reading a line should not have to remember to press
      // a second button, and a take longer than the prompt adds no voice.
      stopTimer.current = setTimeout(() => {
        void finish();
      }, ENROLL_DURATION_MS);
    } catch (e) {
      setPhase('ready');
      setNote(e instanceof Error && e.message ? e.message : 'The recorder could not start.');
    }
  }, [finish, recorder]);

  const busy = phase === 'recording' || phase === 'working';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="px-5 pb-10">
        <Text accessibilityRole="header" className="mt-4 font-heading text-2xl text-foreground">
          Your voice
        </Text>
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          Read one line out loud and the app measures the pitch of your speaking voice. It uses that
          to tell your side of a call from the customer&apos;s.
        </Text>

        {/* The promise sits ABOVE the button, where the decision is made. */}
        <View className="mt-4 rounded-xl border border-primary px-4 py-4">
          <Text className="font-strong text-base text-foreground">What is kept</Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {ENROLL_PRIVACY}
          </Text>
        </View>

        {phase === 'loading' ? (
          <View
            accessible
            accessibilityState={{ busy: true }}
            accessibilityLabel="Loading your voice enrollment"
            className="mt-8 flex-row items-center gap-2"
          >
            <ActivityIndicator color={C['muted-foreground']} />
            <Text className="font-body text-base text-muted-foreground">Loading…</Text>
          </View>
        ) : null}

        {phase === 'unavailable' ? (
          <Panel title={ENROLL_UNAVAILABLE_TITLE} body={ENROLL_UNAVAILABLE_BODY} />
        ) : null}

        {phase === 'error' ? (
          <Panel title="Could not load your voice enrollment" body={message ?? ''} />
        ) : null}

        {phase !== 'loading' && phase !== 'error' && phase !== 'unavailable' ? (
          <>
            {status.enrolled ? (
              <View className="mt-6 rounded-xl border border-border-control px-4 py-4">
                <Text className="font-strong text-base text-foreground">Voice enrolled</Text>
                <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                  {status.f0Hz === null
                    ? // Enrolled but the number did not come back. An unknown is
                      // never dressed as a measurement.
                      'Your reference is stored. The number could not be read back just now.'
                    : `Your reference is ${status.f0Hz} Hz. Read the line again any time to replace it.`}
                </Text>
              </View>
            ) : null}

            <Text className="mt-6 font-emphasis text-xs uppercase tracking-widest text-primary">
              Read this out loud
            </Text>
            <Text className="mt-2 font-body text-lg leading-relaxed text-foreground">
              {ENROLL_PROMPT}
            </Text>

            {recorder === null ? (
              <Panel
                title="Not available in this build"
                body="Recording needs the full app rather than Expo Go. Open this on the build from TestFlight and the microphone will work."
              />
            ) : (
              <Pressable
                onPress={phase === 'recording' ? finish : start}
                disabled={phase === 'working'}
                accessibilityRole="button"
                accessibilityLabel={
                  phase === 'recording'
                    ? 'Stop reading and measure my voice'
                    : status.enrolled
                      ? 'Read the line again to replace my voice reference'
                      : 'Start reading to measure my voice'
                }
                accessibilityState={{ disabled: phase === 'working', busy }}
                style={phase === 'working' ? { opacity: 0.5 } : undefined}
                className="mt-6 min-h-14 items-center justify-center rounded-xl bg-primary active:opacity-80"
              >
                <Text className="font-emphasis text-base text-primary-foreground">
                  {phase === 'recording'
                    ? 'Stop and measure'
                    : phase === 'working'
                      ? 'Measuring…'
                      : status.enrolled
                        ? 'Read again'
                        : 'Start reading'}
                </Text>
              </Pressable>
            )}

            {phase === 'recording' ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-3 text-center font-body text-sm leading-relaxed text-muted-foreground"
              >
                Listening. Read the whole line, then it stops on its own.
              </Text>
            ) : null}

            {note ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-4 font-body text-sm leading-relaxed text-muted-foreground"
              >
                {note}
              </Text>
            ) : null}
          </>
        ) : null}

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mt-8 min-h-11 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Panel({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-6 rounded-xl border border-border-control px-4 py-4">
      <Text className="font-strong text-base text-foreground">{title}</Text>
      {body ? (
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">{body}</Text>
      ) : null}
    </View>
  );
}
