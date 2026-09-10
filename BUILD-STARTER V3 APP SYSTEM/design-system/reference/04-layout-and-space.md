# Layout and space

## The scale

**4dp base.** Every spacing value divisible by 4. Enforced by `DS-002`. Units are
dp — density-independent pixels, the same unit RN uses for every layout number.

```
1→4dp   2→8dp   3→12dp  4→16dp  5→24dp
6→32dp  7→48dp  8→64dp  9→96dp  10→128dp
```

Note the scale is not linear — it opens up as it grows. Even steps at large
sizes waste tokens on distinctions nobody perceives.

Rhythm is what makes unrelated components feel like one system, and it is the
cheapest thing to get right.

## Flexbox only

React Native lays out with **Flexbox and nothing else** — no CSS grid, no float,
no absolute-positioned screen furniture as a layout strategy. Two differences from
the web that catch people out:

- **`flexDirection` defaults to `column`**, not `row`. Every screen is a vertical
  stack until you say otherwise.
- **Percent-of-parent and flex ratios**, not viewport units, do the responsive
  work. A child sizes to its container.

Absolute positioning exists (`position: 'absolute'`) and is the right tool for
overlays, badges and pinned controls — but never for the main document flow.

## Space belongs to the container

Prefer a single `gap` on the parent over a margin on every child. RN margins do
**not** collapse the way CSS margins do, so you will not get the collapse/double
bugs — but per-child margins still make spacing depend on sibling order and
scatter the value across the tree, which is the same maintenance problem.

```tsx
✗  <View><Card style={{ marginBottom: 16 }} /><Card style={{ marginBottom: 16 }} /></View>
✓  <View className="flex-col gap-4"><Card /><Card /></View>
```

`gap` / `rowGap` / `columnGap` are supported on modern RN (verify current for
your version); on an older runtime, fall back to a spacer element or a single
margin on all-but-first.

## Space communicates grouping

The operational rule: **space between groups must visibly exceed space within
them.** A 4dp difference does not register — use a full step.

Because common region beats proximity, a card boundary can group things that are
far apart, and can accidentally group things you meant to separate. Check what
your boundaries actually claim.

## Safe-area insets

Phones have notches, dynamic islands, rounded corners, home indicators and
status bars. Content must sit inside the **safe area**, and full-bleed
backgrounds must extend *under* it.

- Use `react-native-safe-area-context` — `useSafeAreaInsets()` for values,
  `SafeAreaView` / the `edges` prop for padding. Do **not** hard-code a status-
  bar height; it varies by device and changes with each new hardware generation.
- A navigator (expo-router / React Navigation) already insets its headers and
  tab bar. Apply insets yourself for full-screen content and custom bars, and
  avoid double-insetting inside a screen the navigator already padded.
- A colour or image meant to reach the edge extends full-bleed; only the
  *interactive and readable* content respects the inset.

## Responsive to the device

There is no browser viewport. Adapt to the **device and its state**:

- Read size with `useWindowDimensions()` (re-renders on rotation and on iPad
  split-view resize) rather than a one-time `Dimensions.get()`.
- The meaningful breakpoints are **phone → large phone → tablet**, plus
  **orientation**. NativeWind exposes width breakpoints; reserve them for
  genuinely layout-level decisions (one column vs two, tab bar vs rail).
- Nothing clips at the smallest supported width (~320dp) or when system text is
  scaled up. Wide content — tables, code, wide charts — lives inside its own
  horizontal `ScrollView`; the screen itself never scrolls sideways.

## Density for touch

Space is also a hit-target concern, not only an aesthetic one.

- Adjacent touch targets need clear separation so the wrong one is not tapped —
  keep at least a step of the scale between them, and use `hitSlop` to enlarge a
  visually small control's tappable area without enlarging its box.
- Denser layouts (data-dense direction) still keep targets at **44pt / 48dp**;
  tighten the *gaps*, never the targets.

## The first screenful

Attention concentrates at the top of a scroll and thins as it goes — but the
first screenful is no longer a hard barrier; people scroll by default.

- **Do not cram everything into the first screen.** The value proposition and
  the primary action belong up top; the rest can live below.
- **Avoid the illusion of completeness.** A hero that exactly fills the screen
  and looks self-contained stops people scrolling. Let the next section peek
  above the bottom edge so it is obvious there is more.

## Screen composition

- **Vary section rhythm.** Alternating full-bleed and inset sections gives a
  screen structure. Identical section heights read as a template.
- **Vertical rhythm between sections** should be at least 3× the internal
  padding, or the screen reads as one undifferentiated block.
- **Asymmetry creates tension; symmetry creates calm.** Centre deliberately, in
  short passages, for emphasis — never as the default for everything.
- **Optical alignment beats mathematical alignment.** Round shapes overshoot
  their box; punctuation hangs outside the measure.
- **Scale contrast is the cheapest drama available.** 4×+ between display and
  body reads as confident; 1.5× reads as indecisive.

## Stacking order

RN has no global z-index space. Things stack by **render order first**, then by
`zIndex` (on iOS and Android) and Android's `elevation`. Later siblings paint on
top. Keep a named model rather than sprinkling large `zIndex` numbers:

```
base 0 · raised 1 · sticky 2 · overlay 3 · modal 4 · toast 5
```

For anything that must sit above everything — including native views — reach for
the `Modal` component or a portal host rather than fighting `zIndex`, which only
orders views within the same parent.

## Elevation

Shadows model a single light source from above. Two rules:

- **Consistent direction.** Every shadow offsets the same way.
- **Larger elevation = larger blur and larger offset**, not just darker.

Elevation is expressed differently per platform: iOS uses `shadowColor` /
`shadowOffset` / `shadowRadius` / `shadowOpacity`; Android uses a single
`elevation` value (which also drives its stacking). Define elevation as tokens so
both platforms stay in step, and test on both — an iOS shadow and an Android
`elevation` at the "same" level rarely look identical by default.

On dark grounds, shadows barely read. Distinguish surfaces by **lightness step**
instead — this is why dark mode needs a different surface strategy, not an
inverted one.
