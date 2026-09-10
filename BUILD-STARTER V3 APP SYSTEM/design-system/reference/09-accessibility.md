# Accessibility

WCAG 2.2 Level AA is the floor. Note the legal position: the currently cited
baseline in the US DOJ Title II rule and in EN 301 549 v3.2.1 is still **2.1
AA**. 2.2 is a superset, so building to 2.2 satisfies both.

**Automated tooling catches roughly a third of WCAG failures.** Contrast,
name/role/value and landmark checks are reliable. Focus order, meaningful alt
text, and error-recovery flows are not. A green axe run is necessary and never
sufficient — say so when reporting.

---

## The gated subset

These are checked by `tools/gate.mjs`.

| Requirement | SC | Level |
|---|---|---|
| Body text contrast 4.5:1 | 1.4.3 | AA |
| Large text 3:1 (≥24px, or ≥18.66px bold) | 1.4.3 | AA |
| UI components and focus indicators 3:1 | 1.4.11 | AA |
| Visible focus indicator (hardware keyboard / switch / D-pad) | 2.4.7 | AA |
| Focused field not obscured by the keyboard | 2.4.11 | AA |
| Touch targets ≥44×44pt iOS / 48×48dp Android (WCAG floor 24×24dp) | 2.5.8 | AA |
| Images/icons have `accessibilityLabel` (or are `accessibilityElementsHidden`) | 1.1.1 | A |
| Heading order via `accessibilityRole="header"` | 1.3.1 | A |
| Screen has a clear reading/grouping order | 1.3.1 | A |
| App locale set; text localisable | 3.1.1 | A |
| Content fits the screen; respects safe-area insets, no clipping | 1.4.10 | AA |
| Reduced motion honoured | 2.3.3 | AAA (treated as required) |

---

## New in WCAG 2.2

Nine criteria; these six are A/AA and therefore in scope.

**2.4.11 Focus Not Obscured (AA)** — the focused element is not *entirely*
hidden. On device the usual failure is the **software keyboard covering the
focused input**: wrap forms in `KeyboardAvoidingView` (and/or scroll the focused
field into view) so it stays visible. A sticky header or bottom bar overlapping
a focused field is the other case.

**2.5.7 Dragging Movements (AA)** — every drag action has a single-pointer
alternative. A slider needs stepper buttons or a numeric input; drag-to-reorder
needs move-up/move-down controls. Gesture-only actions strand switch and
screen-reader users.

**2.5.8 Target Size (AA)** — WCAG floor is 24×24dp, but design to the platform
minimums: **44×44pt (iOS HIG)** and **48×48dp (Material)**. Five exceptions:
inline targets within a run of text; an OS-controlled size; an equivalent
control elsewhere; an essential presentation (map pins); and the **spacing
exception** — an undersized target passes if a 24dp-diameter circle centred on
it does not intersect another target's circle. A visually small icon can still
meet the size with an expanded `hitSlop`.

**3.2.6 Consistent Help (A)** — where help exists, it appears in the same
relative order across pages. It does not require providing help.

**3.3.7 Redundant Entry (A)** — information already given in the same process
is auto-filled or offered for selection.

**3.3.8 Accessible Authentication (AA)** — no cognitive function test in any
auth step. In practice: never block paste in password or OTP fields, support
password managers, no puzzle CAPTCHA without an alternative, never require
transcribing a code between devices as the only route.

---

## Focus — a pointer/keyboard concern, not a touch one

On a touch screen there is no persistent focus state; a tap acts immediately.
Focus obligations apply when the app is driven by something **other** than a
finger: a hardware keyboard (iPad, Android tablets), Switch Control /
Switch Access, an Android TV / tvOS D-pad, or a screen reader's navigation
cursor. Two distinct things get conflated:

| Concern | Requires |
|---|---|
| **Screen-reader focus** (VoiceOver / TalkBack) | Correct reading order and a meaningful `accessibilityLabel`/`accessibilityRole` on every element the cursor lands on. This is the obligation that matters for almost every app. |
| **Hardware-focus indicator** (keyboard / switch / D-pad) | A **visible** highlight on the currently focused control — 3:1 against its surroundings — so a non-touch user can see where they are. |

For the visible hardware-focus highlight, drive a focused style from the
control's focus callbacks and make it a real lightness/outline change, not a
subtle tint:

```tsx
<Pressable
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
  style={[styles.item, focused && styles.itemFocused]}  // ≥3:1 ring/border
/>
```

Reserve serious effort here for apps that genuinely run on TV, tablet-with-
keyboard, or switch input; for a phone-only touch app, screen-reader focus is
the obligation that counts.

---

## Screen-reader and assistive navigation

- Every interactive element is reachable and operable with VoiceOver / TalkBack,
  and carries an `accessibilityRole` and a meaningful `accessibilityLabel`.
- Reading order matches visual order. It follows the view hierarchy — a layout
  that positions children out of source order (absolute positioning, reversed
  flex) desyncs them, which is a failure. Group related content with
  `accessible={true}` on the wrapper so it is announced as one unit.
- A modal must **trap** the assistive cursor: set `accessibilityViewIsModal` on
  it (iOS) and mark the content behind it `importantForAccessibility="no-hide-descendants"` /
  `accessibilityElementsHidden`, so the reader cannot wander onto the screen
  underneath. Move focus to the modal on open (`AccessibilityInfo.setAccessibilityFocus`)
  and return it to the trigger on close.
- Provide fast navigation: mark section titles with `accessibilityRole="header"`
  so the reader's heading rotor can jump between them — the native equivalent of
  a skip link.
- Hardware keyboard / switch / D-pad: every control is reachable in a sensible
  order and shows the visible focus highlight above.

---

## Motion

The OS **Reduce Motion** setting (read via `AccessibilityInfo.isReduceMotionEnabled()`
or Reanimated's `useReducedMotion`) means remove, reduce, **or replace** — not
"delete all animation". The correct substitution is movement → cross-fade.

**Kill:** parallax, background video, large translation, zoom and scale
transitions, spinning, auto-advancing carousels, programmatic smooth-scroll
jumps. **Keep:** opacity transitions, meaningful state feedback, loading
indicators.

Hard limits:
- **2.3.1 (A)** — nothing flashes more than three times per second.
- **2.2.2 (A)** — auto-starting motion lasting >5s alongside other content needs
  pause/stop/hide. The 5s exception does **not** apply to auto-updating content.
- **1.4.2 (A)** — audio auto-playing for >3s needs a pause/stop or independent
  volume control.

Note the asymmetry: auto-starting motion is Level A, but scroll- and
hover-triggered animation is Level **AAA** (2.3.3) — not legally required.
Given the severity of vestibular reactions (nausea, migraine, days of
recovery), treat it as required anyway.

---

## Text must survive scaling

The device analogue of **1.4.12 (AA)**: users enlarge text system-wide through
**iOS Dynamic Type** and **Android font scale**, and the layout must not break
when they do.

- Leave `allowFontScaling` on (its default) — never disable it to protect a
  layout.
- Never pin a text container to a fixed height; let it grow.
- Test at the largest system font setting, including the accessibility sizes.

Fixed-height containers clipping enlarged text are the usual failure.

---

## Tooling

Native accessibility has **no axe** — there is no automated crawler that catches
even a third of the failures. The primary tools are manual and the platform
inspectors:

- **Turn on the screen reader and use the app.** VoiceOver (iOS) and TalkBack
  (Android). This is the single most valuable check and nothing substitutes for
  it.
- **Xcode Accessibility Inspector** and **Android Accessibility Scanner** audit
  a running build for missing labels, small targets and low contrast.
- **`eslint-plugin-react-native-a11y`** flags missing roles/labels at author
  time (verify current).
- **`@testing-library/react-native`** queries by accessibility role and label,
  which locks structural regressions the way an aria snapshot would — if a query
  by role stops matching, the tree shape changed.

Because none of this is a crawl, an automated pass is even less sufficient here
than on the web: **say plainly that the screen-reader walkthrough is the check
that counts**, and whether it was actually done.
