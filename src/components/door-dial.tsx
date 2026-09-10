/**
 * One door-tracker dial: a count against today's target.
 *
 * SEGMENTED TICKS, NOT A SWEPT RING, for the reason `arena-gauge.tsx` already
 * paid for: rotating a bordered View MOVES a fixed arc, it does not lengthen one,
 * so the ring would show the same partial sweep at every value — plausible in
 * code, nonsense on screen, and invisible to a typecheck. Ticks are arithmetic
 * anyone can check.
 *
 * NO SVG DEPENDENCY. The web draws this inline in SVG; `react-native-svg` is not
 * in this app and a new native module cannot be tested in the build the founder
 * is holding. The same geometry falls out of a rotate-then-push transform, which
 * is how the Arena gauge already draws its arc.
 *
 * THE GEOMETRY IS THE SPEC'S, exactly: 26 ticks over a 300 degree sweep starting
 * at -150 degrees. Zero degrees is straight up and the sweep runs clockwise, so
 * the run ends at +150 and leaves a 60 degree gap centred on the bottom — which
 * is where the count sits.
 *
 * THE COUNT IS TEXT, never colour alone. A rep glancing at a dial between doors
 * reads the number; the lit ticks are the shape of the progress, not the fact.
 *
 * TAP ONLY, NO LONG-PRESS. The 10 September update dropped the long-press
 * decrement: a knock is an immutable logged event with an outcome attached, so
 * there is nothing to take back from here. Undo lives in the door log itself.
 */
import { Pressable, Text, View } from 'react-native';

import { C, TOUCH_TARGET } from '@/lib/theme';

const SIZE = 132;
/** The spec's tick count and sweep. */
const TICKS = 26;
const SWEEP_DEG = 300;
const START_DEG = -150;
const TICK_H = 11;
const TICK_W = 2.9;

export function DoorDial({
  label,
  count,
  target,
  fill,
  onTap,
}: {
  label: string;
  count: number;
  /** Today's target, or 0 when no goal is set. */
  target: number;
  /** 0-1, already clamped by dialFill. */
  fill: number;
  onTap: () => void;
}) {
  const litTicks = Math.round(fill * TICKS);
  // "of 0" would be a target nobody set. The dial still shows the real count.
  const hasTarget = target > 0;

  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel={
        hasTarget
          ? `${label}: ${count} of ${target}. Tap to log one.`
          : `${label}: ${count}. No target set. Tap to log one.`
      }
      accessibilityValue={hasTarget ? { min: 0, max: target, now: count } : undefined}
      // The whole dial is the control, and it is comfortably past the 44pt floor.
      style={{ width: SIZE, height: SIZE, minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET }}
      className="items-center justify-center active:opacity-70"
    >
      {Array.from({ length: TICKS }, (_, i) => {
        const angle = START_DEG + (i * SWEEP_DEG) / (TICKS - 1);
        const lit = i < litTicks;
        return (
          <View
            key={i}
            // Rotate about the centre, then push out along the tick's own axis.
            // One transform, no trigonometry — the technique arena-gauge uses.
            style={{
              position: 'absolute',
              width: TICK_W,
              height: TICK_H,
              borderRadius: TICK_W / 2,
              backgroundColor: lit ? C.primary : C['border-control'],
              transform: [{ rotate: `${angle}deg` }, { translateY: -(SIZE / 2 - TICK_H / 2) }],
            }}
          />
        );
      })}

      <Text className="font-heading text-3xl tabular-nums text-foreground">{count}</Text>
      {hasTarget ? (
        <Text className="font-body text-sm tabular-nums text-muted-foreground">of {target}</Text>
      ) : null}
      <Text className="mt-1 font-body text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
    </Pressable>
  );
}
