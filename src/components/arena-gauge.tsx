/**
 * The Arena's radial gauge — a 270° arc showing the rep's average (spec 5.2).
 *
 * SEGMENTED, NOT A SWEPT RING, and the reason is a bug worth recording. The
 * obvious React Native trick is a bordered View with two transparent sides,
 * rotated by the value. That does not work: rotating a ring MOVES a fixed arc,
 * it does not lengthen one. The gauge would have shown the same half-circle
 * spinning at every score, which looks plausible in code and is nonsense on
 * screen — and nothing in a typecheck, a test or a bundle would have caught it.
 *
 * Twenty-seven ticks laid around 270° and filled proportionally is arithmetic
 * anybody can check, needs no SVG dependency, and reads as a gauge at a glance.
 *
 * REDUCED MOTION IS HONOURED. The spec asks for a count-up; the design law
 * requires motion to respect the system setting. With Reduce Motion on the value
 * simply arrives — the number is the point, the animation is decoration, and
 * decoration is what that setting exists to remove.
 *
 * AN UNSCORED REP GETS AN EMPTY ARC AND AN EM DASH, never a zero-filled gauge.
 * A ring drawn at 0% looks like a measured result; it is not one.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { C } from '@/lib/theme';

const SIZE = 180;
/** Ticks around the arc. 27 over 270° puts one every 10°. */
const TICKS = 27;
const SWEEP_DEG = 270;
/**
 * The arc opens at the BOTTOM, so the gap sits under the caption.
 *
 * 225 deg, not 135. A tick is placed by rotating from 12 o'clock and pushing it
 * outward, so 225 is the 7:30 position; sweeping 270 clockwise ends at 4:30 and
 * leaves the 90 deg gap centred on 6 o'clock. Starting at 135 put the gap on the
 * RIGHT-HAND SIDE instead — the arc would have been the correct length in the
 * wrong place, which arithmetic catches and a typecheck never would.
 */
const START_DEG = 225;
const TICK_H = 14;
const TICK_W = 3;
const STEP_MS = 26;

export function ArenaGauge({
  average,
  bandText,
  sub,
}: {
  /** 0–100, or null when nothing has been scored. */
  average: number | null;
  bandText: string;
  sub: string;
}) {
  const target = average === null ? 0 : Math.max(0, Math.min(100, average));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (cancelled) return;
        if (reduce || target === 0) {
          setShown(target);
          return;
        }
        // A count-up in fixed steps rather than a driver-backed animation: the
        // value is what animates, and the number on screen must agree with the
        // arc at every frame.
        const steps = Math.max(1, Math.round(target / 4));
        let i = 0;
        timer = setInterval(() => {
          i += 1;
          if (i >= steps) {
            setShown(target);
            if (timer) clearInterval(timer);
            return;
          }
          setShown(Math.round((target * i) / steps));
        }, STEP_MS);
      })
      .catch(() => setShown(target));

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [target]);

  const litTicks = average === null ? 0 : Math.round((shown / 100) * TICKS);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={
        average === null
          ? { text: 'Not scored yet' }
          : { min: 0, max: 100, now: Math.round(average) }
      }
      accessibilityLabel={`Average ${
        average === null ? 'not scored yet' : Math.round(average)
      } out of 100. ${bandText}. ${sub}`}
      style={{ width: SIZE, height: SIZE }}
      className="items-center justify-center self-center"
    >
      {Array.from({ length: TICKS }, (_, i) => {
        const angle = START_DEG + (i * SWEEP_DEG) / (TICKS - 1);
        const lit = i < litTicks;
        return (
          <View
            key={i}
            // Each tick is placed by rotating about the centre and pushing it
            // out along its own axis — one transform, no trigonometry.
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

      <Text className="font-heading text-4xl tabular-nums text-foreground">
        {/* An em dash, never a 0 — a zero here reads as a measured result. */}
        {average === null ? '—' : shown}
      </Text>
      <Text className="mt-1 font-emphasis text-sm text-primary">{bandText}</Text>
      <Text className="mt-0.5 font-body text-xs text-muted-foreground">{sub}</Text>
    </View>
  );
}
