/**
 * The bottom tab bar — and there are TWO of them, because Macro Mode swaps the
 * product rather than adjusting a preference.
 *
 * Both sets are the web's own, read out of `SalesCoachShell.tsx`:
 *
 *   MACRO ON  → Home · Pitch Performance · Today's Metrics · Role Play
 *               (the founder's 2026-08-23 revision, which promoted the two
 *                door-to-door DATA surfaces into the nav for one-tap access)
 *   MACRO OFF → Home · Analytics · Sessions · Team Chat · Account
 *               (the 2026-07-04 PWA design, matching the web's MOBILE_TABS
 *                slot for slot AND in order — Analytics sits second there, and a
 *                bottom bar is muscle memory: a rep who moves between the web
 *                and this app must not have to look before tapping)
 *
 * WHY EVERY SCREEN IS DECLARED IN BOTH, with the unused ones hidden: expo-router
 * needs a route to exist to navigate to it, and a rep in Macro Mode must still
 * be able to reach their Account and their sessions — just not from the tab bar.
 * `href: null` removes the tab without removing the route.
 *
 * ICONS ARE FEATHER because lucide — what the web uses — began as a fork of
 * Feather and shares its geometry and stroke weight, and Feather ships as a FONT
 * inside `@expo/vector-icons`. No native module, so no rebuild. Every tab is
 * labelled regardless: the design law forbids anything reachable only by an
 * unlabelled icon, and a screen-reader user hears the word, not the glyph.
 */
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';

import { useMacroMode } from '@/lib/doors/macro-context';
import { C, fontSize } from '@/lib/theme';

/** A tab is an interactive control, so it is bound by the same 48dp floor as
 *  everything else — and a bar sized to its label is one a thumb misses. */
const TAB_MIN_HEIGHT = 56;

type IconName = React.ComponentProps<typeof Feather>['name'];

function icon(name: IconName) {
  // `color` arrives as React Native's ColorValue, which is wider than string —
  // it can be an opaque platform colour. Typed as it really is rather than
  // narrowed with a cast that would hide a genuine mismatch.
  const TabIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Feather
      name={name}
      size={size}
      color={color as string}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
  // Named after the glyph it draws. An anonymous component shows as "Anonymous"
  // in a stack trace and in the React inspector, which turns a one-line tab-bar
  // problem into a hunt through seven identical frames.
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function TabsLayout() {
  const { enabled } = useMacroMode();
  // `null` means not yet known. Treated as the standard product for ONE frame
  // rather than held blank, because the cached answer arrives almost
  // immediately and an empty tab bar reads as a broken app.
  const macro = enabled === true;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C['muted-foreground'],
        tabBarStyle: {
          backgroundColor: C.background,
          borderTopColor: C.border,
          borderTopWidth: 1,
          minHeight: TAB_MIN_HEIGHT,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          // The smallest step on the scale, never a hand-picked pixel — and
          // never below the legibility floor, which is what stopped this app
          // copying the web's 9px tab labels.
          fontSize: fontSize.xs,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />

      {/* ── Macro Mode: the door-to-door product ───────────────────────── */}
      <Tabs.Screen
        name="pitches"
        options={{
          title: 'Pitch Performance',
          tabBarIcon: icon('mic'),
          href: macro ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="metrics"
        options={{
          title: "Today's Metrics",
          tabBarIcon: icon('bar-chart-2'),
          href: macro ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="roleplay"
        options={{
          title: 'Role Play',
          tabBarIcon: icon('target'),
          href: macro ? undefined : null,
        }}
      />

      {/* ── Standard: the coach product ────────────────────────────────── */}
      <Tabs.Screen
        name="analytics"
        options={{
          // The web's Analytics tab is the SKILLS view, not the KPI board. The
          // two were mapped together here because both are "numbers", which
          // reading the web page corrected: one is what the calls added up to,
          // the other is how the rep sells.
          title: 'Analytics',
          tabBarIcon: icon('bar-chart-2'),
          href: macro ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: icon('video'),
          href: macro ? null : undefined,
        }}
      />
      {/* The KPI board keeps its route — reached from Analytics and from Home —
          but is not a tab. The web does not give it one on mobile either. */}
      <Tabs.Screen name="kpi" options={{ href: null }} />
      <Tabs.Screen
        name="chat"
        options={{
          // The web's fifth mobile tab. It was absent rather than stubbed until
          // the chat schema had actually been read — a tab that opens nothing
          // teaches a rep the app is broken.
          title: 'Team Chat',
          tabBarIcon: icon('message-square'),
          href: macro ? null : undefined,
        }}
      />
      {/*
        ACCOUNT IS NOT A TAB. It is the first item of the menu at the top of Home
        (`components/header-menu.tsx`), which is reachable in BOTH modes.

        WHY IT MOVED, and it was not tidiness. Account was a tab in both sets,
        which put the macro bar at five — and at five tabs on a narrow phone the
        LABELS TRUNCATE. The owner photographed a real device showing "Pitch
        Perfo…" and "Today's M…". No check here could have caught that: nothing
        overflows, the text just stops. Four tabs gives the four remaining
        labels room to render whole.

        WHAT MUST NOT REGRESS. Account is the only route to SIGN OUT, and
        sign-out is this app's security boundary on a shared phone — it is what
        stops one rep's calls, transcripts and figures reaching the next person
        to hold it. It was once hidden in Macro Mode and a door rep could not
        sign out at all. The menu lives on Home, which is in both tab sets, so
        that cannot happen again: whatever mode a rep is in, Home is one tap and
        the menu is the next.

        The route stays registered (`href: null`) so every existing link to
        Account keeps working; it simply does not draw a tab.
      */}
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: icon('user'),
          href: null,
        }}
      />
    </Tabs>
  );
}

/**
 * A SECOND boundary, scoped to the tab shell.
 *
 * expo-router renders the NEAREST exported ErrorBoundary, so a screen that
 * throws inside the tabs is caught here rather than at the root — and the tab
 * bar stays on screen. Without this, one crashing tab replaced the entire app:
 * a rep whose Analytics screen threw could not reach Record, which is the one
 * thing they might be standing at a door needing.
 *
 * The root boundary still covers everything outside the tabs, and both render
 * the same surface, so the difference is only how much of the app goes with it.
 */
export { ErrorBoundary } from '@/components/error-boundary';
