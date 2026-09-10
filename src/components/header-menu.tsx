/**
 * The overflow menu at the top of Home.
 *
 * WHY IT EXISTS. Account was a tab in both tab sets, which put the macro bar at
 * five tabs — and at five tabs on a narrow phone the labels truncate: the owner
 * photographed "Pitch Perfo…" and "Today's M…" on a real device, which is
 * exactly the class of defect no layout check catches, because nothing
 * overflows. Moving Account here returns both bars to four and gives the four
 * remaining labels room to render in full.
 *
 * THE DESIGN LAW SAYS NAVIGATION MUST NOT HIDE BEHIND AN UNLABELLED ICON, and
 * that rule is about findability, not decoration. So this is built to satisfy
 * it rather than to slip past it:
 *
 *   - the control carries an `accessibilityLabel` and the `button` role, so a
 *     screen-reader user hears "Menu", never "three dots";
 *   - it is a 44pt target, the platform minimum, despite the glyph being small;
 *   - what it opens is a list of PLAIN WORDS — "Account", "Sign out" — not a
 *     second grid of icons. The icon is the handle; the labels are the
 *     navigation.
 *
 * Account is secondary by nature: it is not what a session is FOR. The tab bar
 * keeps the four things a rep opens the app to do.
 *
 * IT IS ON HOME, WHICH IS IN BOTH TAB SETS. That matters more than it looks:
 * Account is the only route to SIGN OUT, and sign-out is this app's security
 * boundary on a shared phone. A menu that existed only in one mode would strand
 * a door rep signed in on a phone they hand to someone else.
 */

import { useCallback, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { C } from '@/lib/theme';

export type MenuItem = {
  key: string;
  /** The word a person reads and a screen reader announces. Never an icon alone. */
  label: string;
  /** One line saying what it is for, so the label never has to carry it alone. */
  hint: string;
  onPress: () => void;
};

export function HeaderMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);

  const choose = useCallback((item: MenuItem) => {
    // Closed BEFORE navigating: leaving the sheet mounted over a pushed screen
    // is how a menu ends up covering the thing it just opened.
    setOpen(false);
    item.onPress();
  }, []);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Menu"
        accessibilityHint="Opens your account and settings"
        onPress={() => setOpen(true)}
        // 44pt, the iOS minimum and above the 48dp Android floor at this size.
        className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
        hitSlop={8}
      >
        <Feather name="more-vertical" size={22} color={C.primary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        // Android's back gesture must close the sheet, not the screen under it.
        onRequestClose={() => setOpen(false)}
      >
        {/* The scrim is itself the dismiss target, which is what people try
            first. It is labelled, because a screen-reader user needs a way out
            of the sheet that is not a guess. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={() => setOpen(false)}
          className="flex-1 justify-end bg-black/60"
        >
          {/* Stops a tap INSIDE the sheet closing it — the scrim is the parent. */}
          <Pressable
            onPress={() => {}}
            accessible={false}
            className="rounded-t-2xl border-t border-border bg-surface px-5 pb-8 pt-4"
          >
            <View className="mb-2 items-center">
              <View className="h-1 w-10 rounded-full bg-border-control" />
            </View>
            <Text
              accessibilityRole="header"
              className="pb-2 font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
            >
              Menu
            </Text>

            {items.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}. ${item.hint}`}
                onPress={() => choose(item)}
                className="min-h-11 justify-center border-b border-border py-3 active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">{item.label}</Text>
                <Text className="mt-0.5 font-body text-sm text-muted-foreground">{item.hint}</Text>
              </Pressable>
            ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={() => setOpen(false)}
              className="mt-4 min-h-11 items-center justify-center rounded-lg border border-border-control active:opacity-70"
            >
              <Text className="font-emphasis text-base text-foreground">Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
