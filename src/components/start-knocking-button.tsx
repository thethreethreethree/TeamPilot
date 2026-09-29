/**
 * "Start Knocking" — the one button that begins a shift.
 *
 * ONE COMPONENT, TWO PLACES. It sits at the foot of BOTH Home pages: page 1 (the macro home) has always
 * had it, and page 0 (the door target a rep LANDS on) gained it on 2026-09-29 — the founder's REV 1 note
 * "Put start knocking button at the bottom", confirmed in a picker as "bottom of the first Home page".
 * Before that, starting a shift from the landing page meant a swipe first.
 *
 * It is a shared component rather than a second copy because two copies of one button drift: a label,
 * a colour or a destination changed on one page and not the other is exactly the kind of mismatch a rep
 * notices and a test does not.
 */
import { Pressable, Text } from 'react-native';

export function StartKnockingButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Start knocking"
      className="mt-5 min-h-7 items-center justify-center rounded-lg bg-primary px-5 py-4 active:bg-primary-pressed"
    >
      <Text className="font-strong text-base text-primary-foreground">Start Knocking</Text>
    </Pressable>
  );
}
