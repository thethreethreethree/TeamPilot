# 03 — DESIGN BLUEPRINT (App Edition)

Read before generating tokens or writing a component. This sits **under**
`design-system/` — that folder is the enforced law, this is the practice that
survives contact with it.

This is the **native app** edition: React Native, Expo, and **NativeWind**
(Tailwind for React Native). The design-quality principles are the same ones the
web build shipped; only the mechanics that were browser-specific have been
reworked for the device.

---

## 1. The token pipeline, and where it breaks

Tokens are generated from the contract, never hand-picked. That guarantee is real
and worth keeping. But you must know its limit:

> **A generated ramp tapers chroma toward its light and dark ends** to keep steps
> inside the colour gamut. That taper means **the generator may be unable to
> reach your brand colour at the lightness your primary surface needs.**

This is not a bug and you cannot argue with it — some colours do not exist at some
lightnesses. What to do:

1. Find out empirically before designing around an assumption. Generate, then
   look at what your `primary` token actually resolved to.
2. If it cannot reach the brand colour, **add a semantic token pair** — the
   sanctioned mechanism — defining the value explicitly, and register it in the
   theme block.
3. **Verify that pair by hand**, and record the measured ratios. The automated
   contrast audit checks a *fixed list* of pairs and will not check yours. Write
   that limitation down where the next person will see it.

Adding a token pair is normal work. Hand-editing generated colour values is not:
it bypasses the guarantee and the next regeneration silently reverts you.

In this edition the generated tokens feed **two** consumers, and both are
produced by `token-gen`: the **NativeWind / Tailwind config** (`tailwind.config.js`
`theme.extend.colors`, spacing, fontSize, radius) and a **`theme.ts`** consumed
directly in RN for the values a class cannot carry — anything read by an imperative
API or rendered outside the component tree (see §2). Keep the two in sync through
the generator, never by hand.

**Keep hand additions to one marked block** — a clearly fenced region in `theme.ts`
(and its Tailwind mirror) — and record in the contract exactly what must be
re-applied after regenerating, or the next `token-gen` run quietly deletes your
work.

---

## 2. Colour literals: where they are legitimate in RN

There are **no CSS custom properties** in React Native. NativeWind resolves your
utility classes to plain style objects at build/runtime; the token *values* live in
the config and in `theme.ts`. So the rule is simpler than on the web: **a raw colour
literal belongs in the tokens/theme definition file, and nowhere else in the
component tree.**

The one category that legitimately needs the literal restated is **anything rendered
OUTSIDE the component tree**, where no class and no React context is in scope:

- the **native splash screen** background (`expo-splash-screen` / the `expo`
  config's `splash.backgroundColor`)
- the **adaptive icon** background (`android.adaptiveIcon.backgroundColor`) and
  icon/asset config
- the **status bar** style and, on Android, its background
  (`expo-status-bar` / `StatusBar`) — these paint before and around your React tree

Those live in native config (`app.json` / `app.config.ts`) or in a root-level
imperative call, and they cannot import a class. Mirror the generated value there
and note in the contract that it must be updated together with the token — this is
the app analogue of the web's "keep them in sync" duplication.

Everywhere else, colour comes from tokens: a NativeWind class (`bg-primary`,
`text-foreground`) or, where an imperative API demands a value (a `tintColor`, a
navigator theme, a `ripple` colour), an import from `theme.ts`. Never type a hex
into a component.

---

## 3. Typography: the trap that will catch you

**Never combine maximum weight with a widened width axis.**

A variable font's width axis *distorts* letterforms; it is not a separately drawn
width. At 900 weight plus 125% width, type reads as comically overbold and
visibly crammed — and the instinct is to blame the weight.

It is almost always the **stretch**, not the weight. When someone says "too
bold", change one variable at a time and check:

1. Set width back to 100%. Look again.
2. Only then adjust weight.

Changing both at once is how you overcorrect into limp, then have to come back.

**Render a comparison before choosing a face.** Put the real headline and the
real hero number side by side across candidates at the actual sizes on a real
device (or simulator). It takes one screenshot and removes all guessing. Include
the *current* setting as a row so the difference is visible rather than remembered.

App-specific additions:

- **Load fonts with `expo-font`** (`useFonts`, or `expo-font` config plugin for a
  fully native embed). Render nothing that depends on the face until it is loaded,
  or hold the splash screen with `expo-splash-screen` until fonts are ready — a
  flash of the system font is a visible fault.
- **Respect Dynamic Type / `fontScale`.** Users set larger (or smaller) system
  text; RN exposes this via `useWindowDimensions().fontScale` /
  `PixelRatio.getFontScale()`. Do not disable it globally with
  `allowFontScaling={false}` — scale with it, and **test your layouts at a large
  font scale**, where fixed-height rows and single-line labels break first.

Other durable rules, unchanged: one scale ratio and nothing between its steps ·
body ≥ 16 · measure ≤ ~75 characters · line-height tightens as size grows ·
display face chosen for voice, since serif-versus-sans does not affect screen
legibility.

---

## 4. Component patterns that earned their place

**Dynamic class names still do not exist.** NativeWind, exactly like Tailwind,
scans your source for *literal* class strings at build time. `` `object-${position}` ``
is never generated and will silently render nothing. Use a static map:

```
const CROP = { top: "object-top", center: "object-center", bottom: "object-bottom" }
```

**Crop anchoring is data, not a constant.** Different photos need different
anchors. Store the anchor per asset and map it through the static lookup above.

**Never map a huge array into the tree.** A `.map()` over a long list mounts every
row at once and will jank or crash the app. Render long or unbounded lists with
**`FlatList`** (or `SectionList` for grouped data, or `FlashList` for very large or
heavily-recycled lists) so rows virtualize. Reserve raw `.map()` for short, fixed
sets. Give list items stable `key`s and, for `FlashList`, an `estimatedItemSize`.

**The title/value collision.** A title and a large number sharing one flex row
will collide in a narrow column: the title wraps and the unguarded number
overflows through it. Give the number `shrink-0`, or better, restructure so the
title owns its line and the value sits with the action at the foot of the card.

**Equal-height cards.** Push the footer down with an auto top margin (`mt-auto`)
so rows line up regardless of body length.

**Heading / semantics are contextual.** RN has no `<h1>`–`<h6>`; you convey
structure to assistive tech with **`accessibilityRole="header"`** and, where the
platform supports it, a heading level via `accessibilityLevel`. A card does not
know how deep it sits — take the level as a prop, defaulting to the nested case,
so you do not skip a level wherever the other context applies.

**Scrollable regions need accessible reach.** A horizontally scrolling region
(a table, a carousel) must expose an **accessibility role, a label, and a focus
target**, or a screen-reader / switch-control user cannot get to the overflowing
content. Mark the container with `accessibilityRole` and `accessibilityLabel`, and
ensure focus can enter it.

---

## 5. Responsive → device posture

The web question was "which viewport width". The app question is **"which device,
held how, with what chrome around the screen"**. Decide it explicitly and record
it, because "it looked fine on my phone" is the app version of designing one
width and shipping it everywhere.

- **Safe-area insets are not optional.** The usable screen is smaller than the
  physical screen: notch / Dynamic Island at the top, home indicator at the
  bottom, Android status and navigation bars, rounded corners. Read insets from
  the **safe-area context** (`react-native-safe-area-context`:
  `SafeAreaProvider`, `useSafeAreaInsets`, `SafeAreaView`) and pad to them —
  never hardcode a status-bar height.
- **Orientation.** Decide whether the app supports landscape; if it does, every
  gated screen must survive the rotation, not just the ones you happened to turn.
- **Phone vs tablet, and iPad split view.** A tablet is not a big phone — a single
  centred column stranded on an iPad is this edition's version of the web's
  stranded-desktop failure. On iPad your app can also run at a *fraction* of the
  screen in Split View / Slide Over, so width can change at runtime without a
  device rotation.
- **Measure at runtime.** Use `useWindowDimensions()` (it updates on rotation and
  split-view resize) over a one-time `Dimensions.get()`, and drive layout from
  breakpoints — NativeWind's responsive prefixes plus, where a component must
  react to its **own** box rather than the screen, an `onLayout` measurement.
- **Gate at the smallest supported device AND a large one**, and require *both* to
  be good — the audit proves absence of breakage, not quality.

---

## 6. The first screen

Whatever the contract names as the one bold move must be **visible without
scrolling on the SMALLEST supported device**, along with the primary action. This
is the app's "above the fold": the first screen a user sees before any gesture.

**Measure it, do not eyeball it.** Read the rendered bounding box (`onLayout`) and
compare against the safe-area height on the smallest gated device. A headline that
looks fine on your simulator can push the entire value proposition below the fold
on a small phone with a large system font — and you will not notice, because you
know what is down there. Check it with Dynamic Type turned up, too (§3).

---

## 7. Accent discipline

Decide how many places the accent colour may appear, write the number in the
contract, and hold it. Distinctiveness is relational: an element is memorable
because it is bright *where nothing else is*.

When you catch yourself adding a fourth use, the honest move is to remove it —
not to amend the contract to match what you built. Amending a rule to fit the
work is the failure the constitution names.

---

## 8. States are not optional

Every interactive element ships rest, pressed, focused, disabled, plus loading
where async and error where input is possible. A component without its states is
not finished — this is the most common gap between "looks right in a screenshot"
and "feels right in the hand".

Never signal state with colour alone.

App-specific additions:

- **Use platform-native press feedback.** iOS and Android differ on purpose: iOS
  expects an opacity/scale dip, Android expects a material **ripple**. `Pressable`
  gives you both (`android_ripple`, and a `pressed` state via its style callback);
  do not fake one uniform effect on both platforms.
- **Haptics belong on meaningful actions.** A confirm, a toggle, a successful
  submit earn a `expo-haptics` tap; do not buzz on every touch.
- **Dark mode via `useColorScheme()`.** NativeWind supports the `dark:` variant;
  drive it from the system scheme and verify both schemes on real screens, not
  just the one you develop in.
- **Honour reduced motion.** Check `AccessibilityInfo.isReduceMotionEnabled()` /
  `useReducedMotion` and drop or shorten non-essential animation when it is set.
- **Check touch targets.** Verify the component library's default hit areas against
  **44pt on iOS / 48dp on Android**. Several libraries ship compact defaults below
  that; add a size variant (or extend the hit target with `hitSlop`) rather than
  overriding at each call site.

---

## 9. Native form: patterns the web never had

These are first-class design artifacts on an app. Skipping them is not a smaller
design — it is an unfinished one.

**Navigation is structure, and structure is design.** Decide the top-level shape
early — usually a **tab navigator** (2–5 destinations) with a **stack** inside each
tab — using **`expo-router`** (file-based) or React Navigation directly. The tab
bar, its icons, the header treatment, and the transition between screens are
design decisions, not defaults to accept unseen. Give the navigator your token
colours through its theme (from `theme.ts`, per §2), not hardcoded values.

**Platform-adaptive components where iOS and Android genuinely differ.** Some
controls carry strong platform expectations — date/time pickers, action sheets vs
menus, the back affordance (swipe-back on iOS), switches, segmented controls. Where
the platforms genuinely diverge, branch (`Platform.select`, `Platform.OS`) or use a
component that already adapts; do not force one platform's idiom onto the other.
Where they do not diverge, keep one component — branching without a reason is just
two things to maintain.

**Gestures and haptics are part of the composition.** Swipe-to-dismiss,
pull-to-refresh, long-press, drag — built with `react-native-gesture-handler` and
`react-native-reanimated` — should feel native and be paired with haptic feedback
where they confirm an action. Every gesture also needs a non-gesture path for
accessibility; a swipe-only action is unreachable to some users.

**The app icon, adaptive icon, and splash are design surfaces, not afterthoughts.**
The icon is the first thing a user sees and the smallest canvas you will design for
— it must read at the home-screen size. Android's **adaptive icon** is a
foreground layer over a background that the OS masks into varying shapes; design the
foreground with safe margins so no shape crops it. The **splash screen**
(`expo-splash-screen`) is the app's first painted frame — match it to the first
real screen so launch feels continuous, and dismiss it deliberately once your
content (and fonts, §3) are ready, not on a fixed timer.

> Version-specific APIs above (Expo SDK, NativeWind, expo-router, Reanimated) move
> between releases — **(verify current)** against the installed versions before
> relying on an exact name or signature.
