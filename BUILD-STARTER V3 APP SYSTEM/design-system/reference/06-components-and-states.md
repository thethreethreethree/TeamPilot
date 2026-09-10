# Components and states

## A component without its states is not finished

This is the most common gap between "looks right in a screenshot" and "feels
right in the hand".

| State | Requirement |
|---|---|
| **Rest** | Default token colours |
| **Pressed** | The one that matters most on touch. Immediate feedback on touch-down: iOS an opacity/lightness dip, Android a ripple. Must be perceptible before the finger lifts. |
| **Hover** | **Pointer-only — not applicable to touch.** Only fires with an external mouse or trackpad (iPad, desktop). Never gate essential meaning on it, and never leave a control stuck in a hover style. |
| **Focus** | Hardware keyboard / switch / D-pad only. A visible highlight ≥3:1 against surroundings. Not reached by finger taps. |
| **Selected** | Where a control persists a choice (a tab, a segment, a list row): a clear state that is **not colour alone**. |
| **Disabled** | Reduced opacity **and** `accessibilityState={{ disabled: true }}` **and** the `disabled` prop so it is non-interactive. Never colour alone. |
| **Loading** | Where async: spinner or skeleton, plus `accessibilityState={{ busy: true }}`. Preserve the layout box. |
| **Error** | Where input is possible: token colour **and** icon **and** text |
| **Empty** | Where a collection can be empty: written, useful, actionable |

## Press feedback is not optional

Every tappable thing gives feedback the instant it is touched — this is how a
native app feels responsive even before the action completes.

- Use **`Pressable`** as the base; its `pressed` state drives the visual.
  `TouchableOpacity` (iOS-style dim) and `android_ripple` (Material ripple) are
  fine where you want the platform idiom.
- Give feedback on **press-in**, not on release — waiting for the tap to complete
  reads as lag.
- **Haptics for meaningful moments only.** `expo-haptics` — a light selection tick
  on a toggle, a success/error notification on a consequential result. Haptics on
  every tap is noise; reserve them the way you reserve an accent colour.

## Use the primitives

Never hand-roll a modal, action sheet, picker or bottom sheet from bare `View`s.
The hard parts — the Android hardware **back** button closing it, trapping the
accessibility cursor, returning focus, gesture dismissal, safe-area handling —
are exactly what hand-built versions get wrong in ways that only show up with a
screen reader or on the other platform. Use RN's `Modal`, the platform
`ActionSheetIOS` where apt, or a vetted library (a gesture-handler-based bottom
sheet) and verify current.

Customise through **tokens and variants**, never a colour inside a component:

```tsx
✗  <Button style={{ backgroundColor: "#56317E" }}>Save</Button>
✓  <Button>Save</Button>
✓  <Button variant="secondary">Cancel</Button>
```

If a variant does not exist, add it to the component's variant definition so it is
reusable and auditable — do not one-off it at the call site.

## Buttons

- **One primary per screen.** Distinctiveness is relational.
- Hierarchy: `default` → `secondary` → `outline` → `ghost` → `link`
- Destructive actions use `destructive` and **never** sit where a confirm action
  usually is. On a consequential destructive action, confirm (a dialog or action
  sheet) and consider an error-style haptic.
- Labels say what happens: "Create account", not "Submit".
- **Minimum target 44pt (iOS) / 48dp (Android)**, even when the glyph is small —
  pad the `Pressable` or extend `hitSlop`. Never a button the size of its icon.
- Loading state keeps the label and its width — a button that collapses to a
  spinner shifts the layout and moves the next target under the thumb.

## Lists

Long lists are a components decision as much as a performance one.

- **Never `.map()` a long list inside a `ScrollView`** — it renders every row up
  front. Use **`FlatList`** / **`SectionList`** (or **FlashList** for large or
  heavy lists) so rows virtualize.
- Give each row its **pressed** and **selected** states, a stable `keyExtractor`,
  and a written **empty** state via `ListEmptyComponent`.
- Pull-to-refresh and end-reached loading each need their own visible state
  (`refreshing`, a footer spinner) — do not leave the user unsure whether more is
  coming.

## Cards

Cards work because **common region overrides proximity** — a boundary groups more
strongly than closeness. That is also the risk: a card claims everything inside it
is related.

- One card, one idea.
- If the whole card is tappable, make the **card itself** the `Pressable` with
  `accessibilityRole="button"` and a label — not a bare `View` with an `onPress`.
  Nested independently-tappable controls inside a tappable card confuse both touch
  and the screen reader; if you need a secondary action, keep it clearly separate.
- Distinguish by **elevation or border, not both**.

## Tables and dense data

RN has no table primitive, and a web-style table rarely fits a phone.

- Below tablet width, prefer a **list of cards or rows** over a squeezed grid.
- Where a real table is unavoidable, wrap it in a horizontal `ScrollView`; the
  screen itself never scrolls sideways.
- Right-align numbers and use tabular figures (`fontVariant: ['tabular-nums']`)
  so columns line up.

## Modals, sheets and dialogs

- Use RN `Modal` (or a bottom sheet) for an **interrupting** task — never for
  content that is really a screen. A screen belongs in the stack.
- **Android hardware back must dismiss it** (`onRequestClose`), the accessibility
  cursor must be trapped (`accessibilityViewIsModal` / hide the content behind),
  focus moves in on open and returns to the trigger on close.
- The **bottom sheet** is the native idiom for a partial, dismissible surface;
  give it a drag handle *and* a tap-outside / button dismissal (never gesture-only).
- Never nest modals.

## Toasts and feedback

RN has no built-in toast; use a snackbar/toast host or library.

- Confirm the action in its own words: "Publish" → "Published".
- Errors do not auto-dismiss. Successes may, after ≥5s.
- **Announce to the screen reader** — `AccessibilityInfo.announceForAccessibility`
  or an `accessibilityLiveRegion` (Android) — never signal only visually.

## Icons

Use a vector icon set (`lucide-react-native`, `@expo/vector-icons`), which draw
via `react-native-svg`. Decorative icons get `accessibilityElementsHidden` /
`importantForAccessibility="no"`. An icon that is the only content of a control
needs the accessible name on the control:

```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
  <X width={20} height={20} importantForAccessibility="no" />
</Pressable>
```

Never emoji as interface icons — platform-dependent rendering, unintended tone,
announced literally by the screen reader.

## Respect the platform

iOS and Android have different idioms, and forcing one look onto both reads as
foreign. Where a control genuinely differs — the back affordance, the date
picker, the share sheet, switch vs checkbox, action sheets — branch with
`Platform.select` or platform file extensions (`Component.ios.tsx` /
`Component.android.tsx`). Keep the tokens and the information architecture
identical across platforms; let only the platform-conventional chrome differ.
