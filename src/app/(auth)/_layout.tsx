/**
 * The navigator in FRONT of the auth gate.
 *
 * WHY IT EXISTS. Until now `(auth)` held one screen and needed no navigator —
 * the root `<Slot />` rendered sign-in and that was the whole of it. Then
 * `report-problem` was added here so a rep who cannot sign in has some way to
 * say so, and a group with two routes and no Stack is a trap: the push works,
 * and there is no header, no back arrow and no back gesture to return with. A
 * person already stuck at the front door would have been stuck one screen
 * deeper.
 *
 * MIRRORS THE APP'S STACK deliberately — same header colours, same type, same
 * Reduce Motion behaviour — because a rep should not be able to tell that these
 * two screens live under different navigators.
 *
 * SIGN-IN KEEPS ITS OWN LAYOUT. It paints its own full-bleed screen and claims
 * its own top inset, so a header here would put a bar above a screen designed
 * without one.
 */
import { Stack } from 'expo-router';

import { C, fontSize } from '@/lib/theme';
import { useReduceMotion } from '@/lib/use-reduce-motion';

export default function AuthLayout() {
  const reduceMotion = useReduceMotion();

  return (
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
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      {/* A header, and therefore a back arrow: this is the one screen here a
          person needs to be able to leave. */}
      <Stack.Screen name="report-problem" options={{ title: 'Report a problem' }} />
    </Stack>
  );
}
