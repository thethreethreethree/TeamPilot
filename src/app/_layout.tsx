// NativeWind: the compiled stylesheet must be imported ONCE at the app entry or
// no className resolves and every screen renders unstyled.
import '@/global.css';

import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';

import { AuthProvider, useAuth } from '@/lib/auth-context';
import { startCrashReporting } from '@/lib/crash-init';

// Hold the native splash until the fonts are ready, so text never flashes in the
// system face and then reflows. Module scope: this must run before first paint.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Crash reporting, started before the app renders so a crash during the first
// paint is still caught. A no-op unless this build carries a DSN — see
// crash-init.ts. Deliberately NOT inside a component: an error thrown while the
// tree mounts is exactly the one worth having.
startCrashReporting();

/**
 * The auth gate. A signed-out user is sent to (auth); a signed-in user is sent
 * into the app. While the session is being restored from encrypted storage we
 * render nothing over the splash, so the user never sees a flash of the wrong
 * screen.
 *
 * The gate is navigational only. It is not what grants access — every data call
 * is authorized server-side by Row-Level Security or the Bearer token, so the
 * surface and the substance agree rather than the screen being the permission.
 */
function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'signedOut' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'signedIn' && inAuthGroup) {
      // '/(app)/(tabs)', NOT '/(app)/index'. `(app)` is a group, so its index route IS
      // the path — and because a sibling [id] route exists, "/(app)/index" matches
      // the DYNAMIC route with id="index". It typechecks (it fits `/(app)/${string}`)
      // and then sends every rep who signs in straight into the session screen
      // looking for a session called "index". Seen on a real device, not in a test.
      router.replace('/(app)/(tabs)');
    }
  }, [status, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  // Hide the splash on first real layout rather than on a timer — a fixed delay
  // is either too short (flash) or too long (dead air).
  const onLayout = useCallback(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // A font that fails to load is not a reason to trap the user behind the splash
  // forever: fall through to the system face. Render nothing only while genuinely
  // still loading.
  if (!fontsLoaded && !fontError) return null;

  return (
    /**
     * GestureHandlerRootView WRAPS EVERYTHING, and it is not optional.
     *
     * Any `GestureDetector` in the tree throws at render without an ancestor of
     * this type — not a warning, a thrown Error and a red screen. The two-page
     * swipe on Today's Metrics uses one, so that screen crashed on a real
     * device while every check on a laptop stayed green: the typecheck passes,
     * the lint passes, 977 unit tests pass, and none of them mount a component.
     *
     * Found by the owner on check 23 of the device pass, at 09:23 on the first
     * morning anything had actually been run. It is the exact class of defect
     * the runtime gate exists for and the exact reason a green board is not a
     * working app.
     *
     * It must sit ABOVE SafeAreaProvider and the router, because the detector
     * looks for it by context from wherever it happens to be mounted, and any
     * screen may grow a gesture later.
     */
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <View className="flex-1 bg-background" onLayout={onLayout}>
        {/* The status bar paints outside the React tree, so it takes a value,
            not a class. "light" is the CONTENT colour, for our matte-black ground. */}
        <StatusBar style="light" />
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Route-level error boundary for the WHOLE app. expo-router renders the nearest
 * exported ErrorBoundary when a screen throws during render, so a crash in any
 * screen shows a human failure surface instead of a red box or a white screen.
 */
export { ErrorBoundary } from '@/components/error-boundary';

// Resolve the first route to a known one, so a deep link that misses falls to
// +not-found rather than an empty stack.
export const unstable_settings = {
  initialRouteName: '(app)',
};
