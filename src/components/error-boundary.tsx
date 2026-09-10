/**
 * The app-wide failure surface.
 *
 * expo-router renders the nearest exported `ErrorBoundary` when a screen throws
 * during render. Exporting this from the root layout means a crash anywhere
 * shows THIS — a human sentence and a way onward — instead of the red LogBox in
 * development or a silent white screen in a release build. On a commercial app
 * a bare crash reads as "this company is broken" at the worst possible moment.
 *
 * WHY IT LIVES IN ITS OWN FILE and not inline in the layout: a boundary defined
 * in the module it protects can be taken down by the very error it exists to
 * catch. Keeping it separate keeps it independently mountable.
 *
 * The copy answers the user's real question first — "did I lose what I was
 * doing?" — before offering the button. `retry()` re-mounts the failed segment
 * rather than reloading the app, so state elsewhere survives.
 */
import { useEffect } from 'react';
import { Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';

import { reportCaughtError } from '@/lib/crash-init';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    /**
     * Reported, not just logged.
     *
     * This carried a TODO — "forward to real crash reporting before the store
     * release" — and the store release is now the thing being prepared. A
     * boundary that only reached the console meant the rep was told something
     * broke and nobody who could fix it ever was.
     *
     * `reportCaughtError` is safe when reporting is switched off, which is its
     * normal state today: with no DSN it logs and returns. Everything it does
     * send goes through the same scrubbing as any other event, which matters in
     * an app that records customer conversations.
     */
    reportCaughtError(error, 'ErrorBoundary');
  }, [error]);

  return (
    <SafeAreaView className="flex-1 bg-background px-5" accessibilityRole="alert">
      <View className="flex-1 items-start justify-center gap-3">
        <Text className="font-emphasis text-xs uppercase tracking-widest text-destructive">
          Something broke
        </Text>

        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          That did not work
        </Text>

        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          {/* Answers what a rep actually worries about. The old wording covered
              only work the SERVER holds — but this app deliberately keeps
              recordings, doors, outcomes and unsent messages on the phone, and
              somebody standing at a door with forty unsent knocks needs to hear
              about those, not about their sessions. A render crash touches
              neither: both are already written down. */}
          Our fault, not yours. Nothing has been lost — a screen failed to draw, which
          does not touch your calls on the server or the recordings, doors and messages
          this phone is still holding.
        </Text>

        <Pressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
        >
          <Text className="font-strong text-base text-primary-foreground">Try again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
