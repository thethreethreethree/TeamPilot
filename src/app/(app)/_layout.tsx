/**
 * The authenticated stack.
 *
 * WHY A STACK AND NOT A TAB BAR. There are two destinations now — the rep's
 * sessions and the coach — which is below the 3–5 the design law sets for a tab
 * bar, and padding it to three would mean inventing a screen to justify chrome.
 * The law's alternative is "a clearly labelled menu", and its actual requirement
 * is that navigation is never hidden behind a gesture or an unlabelled icon:
 * "Ask the coach" is a labelled primary control on the sessions screen, so the
 * coach is reachable in one tap with no session open, which is the case that
 * matters — a rep pasting a live conversation between doors.
 *
 * THE THIRD DESTINATION IS NOW REAL (the KPI board), which is where the law says
 * a tab bar becomes available. It is still not what this app should have: the
 * coach is opened FROM a session, carrying that session's id, and a tab holds its
 * params after the rep has moved on — so the Coach tab would sooner or later
 * answer about a call they stopped looking at ten minutes ago. A tab bar that
 * lies about what it is showing is worse than no tab bar.
 *
 * So navigation stays the law's other permitted shape: a clearly labelled menu.
 * Every destination is a named control on the sessions screen, nothing is behind
 * a gesture or a bare icon, and the coach keeps the session it was opened from.
 * Revisit if a destination arrives that nothing pushes parameters into.
 *
 * The navigator paints its header outside the React tree, so it takes colour
 * VALUES from the theme bridge rather than classNames.
 */
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Stack } from 'expo-router';
import { C, fontSize } from '@/lib/theme';
import { useReduceMotion } from '@/lib/use-reduce-motion';
import { useAuth } from '@/lib/auth-context';
import { useAutoSend } from '@/lib/audio/use-auto-send';
import { useOutbox } from '@/lib/sync/use-outbox';
import { claimUnclaimedRecordings } from '@/lib/audio/recording-store';
import { recoverInterruptedRecording } from '@/lib/audio/in-flight';
import { MacroProvider } from '@/lib/doors/macro-context';

export default function AppLayout() {
  const reduceMotion = useReduceMotion();

  // Mounted here rather than on the recordings screen: a rep should not have to
  // be looking at the right screen for their calls to be sent.
  const { user } = useAuth();
  const userId = user?.id ?? null;

  /**
   * Pick up anything recorded while signed out.
   *
   * Runs here rather than on the sign-in screen because it must happen however
   * the rep arrives — a fresh sign-in, a restored session, a relaunch. Attaching
   * is idempotent: a recording already claimed is not claimed twice.
   */
  useEffect(() => {
    if (!userId) return;
    claimUnclaimedRecordings(userId).catch(() => {
      // The recordings stay unattached and are offered again next launch.
    });
  }, [userId]);

  /**
   * A call that never got to stop.
   *
   * Runs ONCE per launch, not once per sign-in: the recovery either saves the
   * audio or reports it gone, and doing that again when the rep signs in would
   * either be a no-op or a second announcement of the same bad news.
   *
   * Ordered BEFORE the claim above in effect — the recovered file lands in the
   * unclaimed bucket when nobody was signed in at the time, and the claim on the
   * next sign-in picks it up, which is the path that already exists.
   *
   * It speaks. Every other background sweep in this app is deliberately silent,
   * because a rep does not need to be told that something worked. This one is
   * different: an interrupted call is a fact about a conversation they had, and
   * whether the audio survived changes what they do next — re-record while it is
   * fresh, or carry on. Silence here would be the app knowing something about
   * their day and not saying it.
   */
  const recovered = useRef(false);
  useEffect(() => {
    if (recovered.current) return;
    recovered.current = true;
    (async () => {
      const result = await recoverInterruptedRecording(userId);
      if (result.kind === 'none') return;
      if (result.kind === 'recovered') {
        Alert.alert(
          'A call was recovered',
          'The app closed before your last recording was stopped. The audio was saved and is on the "Waiting to send" screen — its length is unknown, because the app was not running when it ended.',
        );
        return;
      }
      if (result.kind === 'deferred') {
        Alert.alert(
          'A call is still being recovered',
          'The app closed during a recording and the audio could not be saved this time. It has not been discarded — the app will try again next time it opens.',
        );
        return;
      }
      Alert.alert(
        'A recording was lost',
        'The app closed during a call and the phone cleared the audio before it could be saved. Nothing was captured. If the conversation still matters, it is worth writing down now.',
      );
    })().catch(() => {
      // Recovery is best-effort. A failure here leaves the marker in place and
      // the next launch tries again; announcing an error about a recovery the
      // rep never asked for would be noise.
    });
  }, [userId]);

  useAutoSend(userId);
  // Mounted beside it and not inside it: a queued outcome must not wait behind a
  // 25 MB upload on a connection that has only just come back.
  useOutbox(userId);

  return (
    <MacroProvider>
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'default',
        headerStyle: { backgroundColor: C.background },
        headerTintColor: C.foreground,
        headerTitleStyle: {
          color: C.foreground,
          fontFamily: 'Inter_600SemiBold',
          fontSize: fontSize.lg,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: C.background },
      }}
    >
      {/* The tab bar owns Home, Sessions, Analytics and Account, and paints its
          own headers — so this Stack shows none for it. Everything below is a
          screen you PUSH onto a tab: it keeps the back arrow, and the tab bar
          stays out of its way. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="doors" options={{ title: 'Door log' }} />
      <Stack.Screen name="training" options={{ title: 'Training' }} />
      <Stack.Screen name="topic/[topicId]" options={{ title: 'Topic' }} />
      <Stack.Screen name="oneliners" options={{ title: 'One liners' }} />
      <Stack.Screen name="[id]" options={{ title: 'Session' }} />
      <Stack.Screen name="pitch/[pitchId]" options={{ title: 'Pitch' }} />
      <Stack.Screen name="coach" options={{ title: 'Ask the coach' }} />
      <Stack.Screen name="progress" options={{ title: 'Your points' }} />
      <Stack.Screen name="scoreboard" options={{ title: 'Scoreboard' }} />
      <Stack.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Stack.Screen name="calibration" options={{ title: 'Score calibration' }} />
      <Stack.Screen name="trend" options={{ title: 'How it is moving' }} />
      <Stack.Screen name="team" options={{ title: 'Your team' }} />
      <Stack.Screen name="record" options={{ title: 'Record a call' }} />
      <Stack.Screen name="recordings" options={{ title: 'Waiting to send' }} />
      <Stack.Screen name="report-problem" options={{ title: 'Report a problem' }} />
    </Stack>
    </MacroProvider>
  );
}

/**
 * The middle boundary, for PUSHED screens.
 *
 * Three now nest, each keeping as much of the app on screen as it can:
 *
 *   root            everything else — sign-in, not-found
 *   (app)           a pushed screen; the Stack header and its BACK BUTTON stay,
 *                   so a rep whose pitch detail throws can simply go back
 *   (app)/(tabs)    a tab screen; the tab bar stays
 *
 * Without this one, a crash in any of the fifteen pushed screens fell all the
 * way to the root and replaced the whole app — leaving a rep with a message and
 * no way back to the list they came from.
 */
export { ErrorBoundary } from '@/components/error-boundary';
