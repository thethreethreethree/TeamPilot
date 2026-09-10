/**
 * Two pages, one toggle, one swipe (spec §1.1).
 *
 * THE TOGGLE IS THE PRIMARY CONTROL AND THE SWIPE IS THE ENHANCEMENT, which is
 * the spec's wording and also the design law's: an affordance that exists only
 * as a gesture is invisible, and a rep who never discovers it simply never sees
 * half the screen. So the segmented control is always there, always labelled,
 * and reaches both pages on its own. Every part of the gesture below could be
 * deleted and the screen would still work.
 *
 * THE RULES LIVE IN `lib/pager.ts`, not here. Axis lock, rubber band and the
 * snap threshold are exact decisions with exact answers, and a gesture handler
 * is the worst place to keep an exact answer — it can only be exercised by a
 * finger. They are unit-tested there, and six deliberate breakages were proven
 * to fail those tests.
 *
 * BOTH PAGES STAY MOUNTED. The spec asks for it, and the reason is felt rather
 * than argued: a page mounted on arrival has already loaded, so the swipe
 * reveals a screen rather than a spinner.
 *
 * EACH PAGE OWNS ITS SCROLL. The pager never wraps the pages in a scroll view
 * of its own — a vertical gesture is left entirely alone, and the axis lock is
 * what guarantees the horizontal one does not steal it.
 */

import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

import { axisOf, restingOffset, snapTarget, trackOffset } from '@/lib/pager';

export type PagerPage = {
  key: string;
  /** The word on the toggle, and what a screen reader announces. */
  label: string;
  render: () => React.ReactNode;
};

export function SwipePager({
  pages,
  subscribeReset,
}: {
  pages: PagerPage[];
  /**
   * Subscribe to an external "go back to the first page" signal, returning the
   * unsubscribe. Spec 06 §3: "the page index is NOT persisted; the Home tab also
   * snaps back to page 0."
   *
   * A SUBSCRIPTION RATHER THAN A COUNTER PROP, and the difference is not
   * cosmetic. A counter would have to be turned back into an action inside an
   * effect — setting state synchronously in an effect body, which cascades
   * renders and which this repo's lint refuses on sight. A tab press genuinely
   * IS an external event, so it arrives the way external events are supposed to:
   * the pager subscribes, and the page changes in the callback.
   *
   * OPTIONAL, and absent on Today's Metrics on purpose: that tab has no such
   * rule, and a pager that silently rewound whenever a rep came back to it would
   * take the page away from them without being asked to.
   */
  subscribeReset?: (goToFirst: () => void) => () => void;
}) {
  /**
   * OPTED OUT OF THE REACT COMPILER, for one component, with a reason.
   *
   * Reanimated's shared value is a MUTABLE box on purpose — writing `.value` is
   * the whole API, and it is what lets the UI thread read the track without JS.
   * The compiler's immutability rule cannot model that: it sees a value handed
   * to `useAnimatedStyle` and then written to, and calls it an error. It is
   * right about ordinary React state and wrong about this one type.
   *
   * The narrow opt-out is the honest answer. The alternatives were to disable
   * the rule repo-wide, which would stop it catching the real bugs it is for,
   * or to move the pager's tested rules into worklets, which would put exact
   * answers somewhere only a finger can reach.
   */
  'use no memo';

  const { width } = useWindowDimensions();
  /** Spec §1.1: Progress is index 0 and is where every open lands. */
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  /**
   * A REANIMATED SHARED VALUE, and it must be — this is the second defect the
   * device pass found, minutes after the first.
   *
   * This was `new Animated.Value(0)`, the legacy API. `GestureDetector` belongs
   * to gesture-handler v2, which attaches its handlers by SERIALIZING the
   * closure to the UI thread as a worklet. An `Animated.Value` cannot cross that
   * boundary, so attaching threw `[Worklets] Cannot copy value of type
   * AnimatedValue` and the screen died at render.
   *
   * The two animation worlds do not mix, and nothing on a laptop can tell you
   * so: the types are fine, the lint is fine, and the failure only exists once
   * a real UI thread tries to copy the value. A shared value is designed to
   * cross, so the track now lives in the world its gesture already lived in.
   *
   * WHY `react-hooks/immutability` IS SUPPRESSED WHERE THIS IS WRITTEN TO, and
   * why that is a suppression rather than a dodge. The rule holds that a value
   * returned from a hook must not be mutated, and for React state it is exactly
   * right. A shared value is not React state: it is a mutable box whose whole
   * purpose is to be written from JS and read from the UI thread, and `.value =`
   * is the entire public API. There is no way to use Reanimated that satisfies
   * the rule.
   *
   * The alternatives were worse. Turning the rule off repo-wide would stop it
   * catching the real bugs it exists for. Dropping to `PanResponder` and the
   * legacy `Animated` would abandon the stack the design law names. Marking the
   * pager's rules as worklets would move exact, tested answers into a runtime
   * only a finger can exercise. So: two narrow suppressions, both pointing
   * here — and only two, because the writes inside `settle` do not trip the
   * rule at all once the shared value is out of that callback's dependencies.
   * Four were written first; the two the linter said were unnecessary were
   * removed rather than left as decoration.
   */
  const translate = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const settle = useCallback(
    (next: number) => {
      setIndex(next);
      const to = restingOffset(next, width);
      if (reduceMotion) {
        // Spec §1.1: no transition under Reduce Motion. The page still changes —
        // suppressing the movement is not suppressing the navigation.
        translate.value = to;
        return;
      }
      // Critically damped-ish: it arrives without the bounce that would make a
      // data screen feel like a toy. Runs on the UI thread, so a busy JS thread
      // cannot make the page stutter.
      translate.value = withSpring(to, { damping: 22, stiffness: 220, mass: 0.6 });
    },
    /* `translate` is NOT a dependency. A shared value is a stable box, like a
       ref — its identity never changes, so listing it would be noise, and the
       immutability rule correctly refuses a value that is both a declared
       dependency and a mutation target. Dropping it is the accurate answer
       rather than the convenient one. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduceMotion, width],
  );

  // A rotation, a fold, or a large-text change alters the width; the track has
  // to be re-seated or the page drifts off-centre by the difference.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- see the note on `translate`
    translate.value = restingOffset(index, width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, index]);

  // The Home tab, tapped. The screen stays mounted across tab presses, so
  // `useState(0)` on mount cannot be the whole of it — the owner supplies the
  // signal and the rewind happens in the callback, never in the effect body.
  // Re-subscribing when `settle` changes (a rotation, Reduce Motion) is free: it
  // swaps the listener and moves nothing.
  useEffect(() => {
    if (!subscribeReset) return;
    return subscribeReset(() => settle(0));
  }, [subscribeReset, settle]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      // The lock is asked on every frame but only answers once the finger has
      // travelled; until then nothing moves, which is what leaves a tap a tap.
      if (axisOf(e.translationX, e.translationY) !== 'horizontal') return;
      // The resting offset is DERIVED from the page, not remembered from the
      // start of the drag. A remembered one is a second copy of the same fact,
      // and it goes stale the moment the width changes mid-gesture — a rotation
      // during a swipe would otherwise leave the track offset by the difference.
      // eslint-disable-next-line react-hooks/immutability -- see the note on `translate`
      translate.value = restingOffset(index, width) + trackOffset(e.translationX, index, pages.length);
    })
    .onEnd((e) => {
      if (axisOf(e.translationX, e.translationY) !== 'horizontal') {
        settle(index);
        return;
      }
      settle(snapTarget(e.translationX, index, pages.length, width));
    })
    // Vertical scrolling inside a page must win. Without this the pager competes
    // with the page's own list and the loser is whoever the rep was actually
    // talking to.
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    /**
     * HANDLERS RUN ON THE JS THREAD, deliberately.
     *
     * The rules — axis lock, rubber band, snap threshold — live in `lib/pager.ts`
     * as ordinary tested functions. A worklet cannot call an ordinary function;
     * it would have to be marked `'worklet'`, which would put the exact answers
     * back inside the animation runtime where only a finger can exercise them.
     *
     * The trade is one bridge hop per frame while a finger is down, against the
     * rules staying unit-tested. The ANIMATION itself is still native — the
     * shared value is read on the UI thread — so what this costs is the drag
     * tracking, not the spring.
     */
    .runOnJS(true);


  return (
    <View className="flex-1">
      {/* The primary control. A tablist, so a keyboard or switch user moves
          between the two with the same words a sighted rep reads. */}
      <View accessibilityRole="tablist" className="flex-row gap-2 px-4 pb-3 pt-2">
        {pages.map((page, i) => {
          const active = i === index;
          return (
            <Pressable
              key={page.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${page.label}, page ${i + 1} of ${pages.length}`}
              onPress={() => settle(i)}
              className={`min-h-11 flex-1 items-center justify-center rounded-lg border active:opacity-70 ${
                active ? 'border-primary bg-primary' : 'border-border-control bg-surface'
              }`}
            >
              <Text
                className={`font-emphasis text-base ${
                  active ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {page.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <GestureDetector gesture={pan}>
        <View className="flex-1 overflow-hidden">
          <Animated.View
            /* The shared value goes straight into the style. Reanimated reads
               it on the UI thread, so the track follows the finger without a
               round trip through JS — and without `useAnimatedStyle`, which
               would hand the value to a hook and then write to it, the one
               shape the immutability rule is right to refuse. */
            style={{
              flex: 1,
              flexDirection: 'row',
              width: width * pages.length,
              transform: [{ translateX: translate }],
            }}
          >
            {pages.map((page, i) => (
              <View
                key={page.key}
                // `flex: 1` as well as the width: a page must claim the track's full height explicitly rather
                // than inheriting it by the row's default stretch, so a page whose own content is short does not
                // end up a short pane with dead space under it.
                style={{ width, flex: 1 }}
                // The page a rep is not looking at is hidden from the screen
                // reader: swiping through controls should not walk into the
                // other page's list without ever being told it moved.
                accessibilityElementsHidden={i !== index}
                importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
              >
                {page.render()}
              </View>
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}
