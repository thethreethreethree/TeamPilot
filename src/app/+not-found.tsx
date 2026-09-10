/**
 * The catch-all route. expo-router renders this for any path it cannot match —
 * and on a phone that is almost never a mistyped URL. It is a DEEP LINK or a
 * PUSH NOTIFICATION pointing at something no longer there: a session that was
 * removed, a screen a newer build dropped, a link shared by a colleague on a
 * different version.
 *
 * The person arrives mid-intent with no context, so this screen has one job —
 * get them somewhere real without implying they broke anything.
 *
 * It offers a definite way home rather than a browser-style "back": a cold
 * launch straight into a dead link has an empty back stack, so there is nothing
 * to go back to. `replace` always resolves.
 */
import { Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth-context';

export default function NotFound() {
  const router = useRouter();
  const { status } = useAuth();

  // Send a signed-out arrival to sign-in, not into the app behind the gate.
  const goHome = () =>
    router.replace(status === 'signedIn' ? '/(app)/(tabs)' : '/(auth)/sign-in');

  return (
    <SafeAreaView className="flex-1 bg-background px-5">
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-start justify-center gap-3">
        <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
          Not found
        </Text>

        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          That link does not go anywhere
        </Text>

        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          Whatever it pointed to has moved or been removed. Nothing you were doing
          was lost.
        </Text>

        <Pressable
          onPress={goHome}
          accessibilityRole="button"
          accessibilityLabel={status === 'signedIn' ? 'Go to your sessions' : 'Go to sign in'}
          className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
        >
          <Text className="font-strong text-base text-primary-foreground">
            {status === 'signedIn' ? 'Your sessions' : 'Sign in'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
