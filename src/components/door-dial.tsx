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
 * THE TAP NAVIGATES; IT DOES NOT LOG. Every dial's `onTap` is the same handler and it opens the
 * Door Log. That is correct and deliberate: a door carries an outcome - sold, go back, not
 * interested, no answer - and one tap on a dial cannot say which. The hint under the dials said
 * "Tap a dial to log one" until 2026-09-11, which described something this control has never done.
 *
 * NO LONG-PRESS. The 10 September update dropped the long-press decrement: a knock is an immutable
 * logged event with an outcome attached, so there is nothing to take back from here. Undo USED to
 * live in the door log itself; REV 1 removed it on 2026-09-11 and nothing replaced it, so at
 * present a logged door cannot be taken back anywhere. That is on the build board as a decision
 * rather than left as a surprise.
 */
import { Pressable, Text, View } from 'react-native';

import { C, TOUCH_TARGET } from '@/lib/theme';

/**
 * THE RING, SIZED SO THREE FIT IN ONE ROW.
 *
 * It was 132, and three of those cannot sit side by side on a phone: 3 x 132 plus two 8pt gaps is
 * 412, against roughly 327 of usable width once the screen's px-5 is taken off a 375pt device. The
 * row wrapped, and the founder's screenshot shows the result - two dials above, one stranded below,
 * in a triangle nobody designed.
 *
 * 96 is the largest size that leaves the row honest on the narrowest phone we target:
 * (327 - 16) / 3 is about 103 per column, so a 96 ring clears with room for its border of ticks.
 * The web reaches the same answer from the other direction - a 104px SVG inside a three-column grid
 * capped at max-w-md.
 *
 * Still far past the 48dp touch floor, and the whole column is the control, not just the ring.
 */
const SIZE = 96;
/** The spec's tick count and sweep. */
const TICKS = 26;
const SWEEP_DEG = 300;
const START_DEG = -150;
/** Scaled with the ring, so the band of ticks stays the same fraction of it. */
const TICK_H = 9;
const TICK_W = 2.6;

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
      /*
        "Tap to log one" was false and had been since the dials were built - this tap opens the Door
        Log and has never logged anything. The same sentence was removed from the visible hint under
        the dials earlier today; this copy of it was missed, because a sweep for the WORDS found the
        hint and not the accessible name. A screen-reader user was the only one still being told it.
      */
      accessibilityLabel={
        hasTarget
          ? `${label}: ${count} of ${target}. Opens the door log.`
          : `${label}: ${count}. No target set. Opens the door log.`
      }
      accessibilityValue={hasTarget ? { min: 0, max: target, now: count } : undefined}
      /*
        FLEX-1, NOT A FIXED WIDTH. Three equal columns share whatever the screen gives them, so the
        row divides instead of overflowing and wrapping. The ring inside keeps its fixed geometry;
        only the column around it flexes.
      */
      style={{ minHeight: TOUCH_TARGET }}
      className="flex-1 items-center active:opacity-70"
    >
      <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
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
        <Text className="font-body text-xs tabular-nums text-muted-foreground">of {target}</Text>
      ) : null}
      </View>

      {/*
        THE LABEL SITS BELOW THE RING, NOT INSIDE IT.

        This was the second half of the founder's note - "the text inside needs to be fixed, it's
        going over the circle". It was a child of the ring's own fixed box, so a word wider than the
        ring had nowhere to go: "PRESENTATIONS" is thirteen characters of uppercase at the widest
        tracking on the scale, and it broke out over the ticks and into the next dial.

        Out here it belongs to the whole column instead, which is wider than the ring. The web does
        the same thing - its label is a sibling under the SVG, never inside it.

        `tracking-wide` rather than `tracking-widest`: the extra letter-spacing bought nothing and
        cost about a character's width on the longest label of the three.

        `adjustsFontSizeToFit` is the floor under all of it. The smallest size on this project's
        type scale is 12, so there is no smaller token to reach for, and "PRESENTATIONS" at 12 is
        still a shade wider than a third of a narrow phone. One line, shrink to fit, never spill -
        rather than a word that silently overlaps its neighbour on exactly the devices nobody tests.
      */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="mt-1 font-body text-xs uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Text>
    </Pressable>
  );
}
