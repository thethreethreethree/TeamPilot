# Motion

## Motion must mean something

Animation exists to explain a state change: where something came from, what it
belongs to, that something happened, how long something will take.

Decorative motion with no communicative function is the most common tell of a
design that is performing rather than working. It is also, in 2026 design
commentary, explicitly named as a form of dishonesty — motion that implies
sophistication the product does not have.

## Reduced motion is required

Honour the OS **Reduce Motion** setting (iOS: Settings → Accessibility → Motion;
Android: Remove animations). Gated. There is no global stylesheet on device —
read the flag and branch.

```tsx
import { useReducedMotion } from "react-native-reanimated";
// or, without Reanimated: AccessibilityInfo.isReduceMotionEnabled()
//   + AccessibilityInfo.addEventListener("reduceMotionChanged", …)

const reduce = useReducedMotion();
const entering = reduce ? FadeIn : SlideInRight;   // movement → cross-fade
```

Read it once at the animation site and subscribe to changes — a value cached at
launch goes stale when the user toggles the setting. Reanimated's own
higher-level layout animations already consult the flag on supported platforms
(verify current), but any manual worklet you write must check it yourself.

**Reduce does not mean "delete all animation."** It means remove, reduce, or
**replace**. The correct substitution is movement → cross-fade.

| Kill | Keep |
|---|---|
| Parallax | Opacity / colour cross-fades |
| Background video | Meaningful state feedback |
| Large translation, panning | Loading indicators |
| Zoom and scale transitions | Anything whose removal breaks comprehension |
| Spinning, orbiting | |
| Auto-advancing carousels | |
| Animated auto-scroll / programmatic smooth-scroll jumps | |

## Hard limits

- **WCAG 2.3.1 (A)** — nothing flashes more than three times per second.
- **WCAG 2.2.2 (A)** — auto-starting motion lasting >5s alongside other content
  needs pause/stop/hide. **The 5s exception does not apply to auto-updating
  content** (feeds, tickers). Auto-rotating carousels are the canonical failure.
- **WCAG 1.4.2 (A)** — audio auto-playing for >3s needs a pause/stop or
  independent volume control. Muting the OS does not satisfy it.

Note the asymmetry: automatically-starting motion is Level **A**, but scroll-
and hover-triggered animation sits at Level **AAA** (2.3.3) — i.e. not legally
required. Given that vestibular reactions include nausea, migraine and days of
recovery, treat 2.3.3 as required anyway.

## Craft

- **One easing set, one duration set**, project-wide.
- **Enter faster than exit.** Arriving is informative; leaving is not.
- **Animate `transform` and `opacity` only.** These are the properties that run
  on the UI/native thread (Reanimated worklets, or `useNativeDriver: true` on
  the core `Animated` API). Animating layout props — width, height, margin,
  flex, `top`/`left` — cannot use the native driver, runs on the JS thread, and
  drops frames under load.
- **Durations:** 100–160ms micro-interactions · 240ms transitions · 400ms+ only
  for large spatial moves. Anything over 500ms feels broken unless it is
  carrying a genuinely large distance.
- **Never animate an element the user is about to tap.** A button that moves
  under the thumb is a Fitts's Law violation with attitude.
- **Stagger sparingly.** 30–50ms between siblings, and only for lists under ~8
  items. Beyond that the last item arrives late enough to feel broken.

## One moment, not ambient motion

An orchestrated sequence reads as designed. Scattered animation everywhere reads
as generated. If the direction calls for motion as its thesis, spend it in one
place and execute it precisely — and ensure the screen is complete and static
without it.

## What to reach for

Keep animation on the UI thread. Reach for the declarative layer first; drop to
manual worklets only where it genuinely cannot express the motion.

| Need | Tool | Notes |
|---|---|---|
| Enter/exit of conditional content, list item add/remove | Reanimated layout animations (`FadeIn`/`SlideIn…`, `entering`/`exiting`, `Layout`) | Runs on the UI thread; honours Reduce Motion on supported platforms (verify current) |
| Screen/route transitions | The navigator's own transitions — Stack `animation` options in expo-router / React Navigation, and shared-element transitions | Prefer platform-default transitions; they match user expectation |
| Spring, drag, gesture-driven motion | Reanimated worklets + `react-native-gesture-handler` | Gesture on the UI thread avoids JS-thread jank |
| Simple one-off layout change | Core `LayoutAnimation` | Limited and less predictable than Reanimated (verify current) |

- Prefer **react-native-reanimated** for anything non-trivial: its worklets run
  on the UI thread, so motion survives a busy JS thread.
- Use the **navigator's** transition system for moving between screens rather
  than hand-rolling one — it carries the back-gesture and platform direction for
  free.

### Native transition gotchas

- Gesture-driven and worklet animations must run on the UI thread (Reanimated)
  or they stutter whenever JS is busy — the whole point of the library.
- The interactive **back-swipe** (iOS edge swipe, Android predictive back) is
  driven by the navigator; a custom screen transition that ignores it breaks a
  gesture users rely on. Let the navigator own it.
- Shared-element transitions are still evolving in RN (verify current) — treat
  them as an enhancement, and make sure the screen is complete and correct
  without the effect.
