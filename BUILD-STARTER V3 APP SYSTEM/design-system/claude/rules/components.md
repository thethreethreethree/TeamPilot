---
paths:
  - "components/**"
  - "src/components/**"
  - "app/**/_components/**"
  - "**/ui/**"
---

# Component rules

## A component is not finished until it has all its states

Every interactive element ships its full set of states. Missing states are the
most common reason a build that looks fine in a screenshot feels broken in use.

| State | Requirement |
|---|---|
| Rest | Default token colours |
| Press / active | Perceptible change on `onPressIn` — a lightness step, not a colour swap. Use `Pressable`'s pressed state or an `activeOpacity` |
| Focus | Visible focus ring for keyboard, switch-control and external-keyboard users, ≥3:1 against both the control and the screen. Touch is not the only input |
| Disabled | Reduced opacity **and** `accessibilityState={{ disabled: true }}`. Never rely on colour alone |
| Loading | Where an action is async: a spinner or skeleton, plus `accessibilityState={{ busy: true }}` |
| Error | Where input is possible: token colour **and** an icon **and** text |

Never signal state with colour alone (WCAG 1.4.1) — around 8% of men have a
colour-vision deficiency.

Hover exists only for pointer input (external mouse/trackpad on iPad or a
desktop target) and must never be the *sole* affordance — there is no hover on
touch. Press feedback, not hover, is the primary state on a phone.

## Primitives

Use accessible primitives and battle-tested libraries. Do not rebuild a modal,
select, action sheet, bottom sheet or tooltip by hand: focus handling, the OS
back-gesture, `accessibility*` wiring and gesture conflicts are the hard parts,
and hand-rolled versions get them wrong. Reach for React Native's own
`Modal`/`Pressable`/`FlatList` and a maintained sheet/menu library **(verify
current)** before writing your own.

Customise through **tokens and variants**, never by editing colour inside a
component. If a variant does not exist, add it to the component's variant map so
it is reusable and auditable.

```tsx
// wrong — bypasses the token layer
<Pressable style={{ backgroundColor: "#56317E" }}>…</Pressable>
<Button className="bg-[#56317E]">Save</Button>

// right
<Button>Save</Button>
<Button variant="secondary">Cancel</Button>
```

## Composition

- Keep components small and prop-driven. Lift shared state to a screen or a
  provider; a leaf component reads tokens and renders.
- Memoise list rows (`React.memo`) and keep callbacks stable (`useCallback`) so a
  parent re-render does not re-render an entire list — the most common source of
  scroll jank.
- Long or heavy lists use `FlatList` / `SectionList` (or `FlashList`), never
  `.map()` inside a `ScrollView`. Give rows a stable `keyExtractor`.
- Respect the safe-area insets (`useSafeAreaInsets` / `SafeAreaView`) so content
  never sits under the notch, the status bar or the home indicator.

## Sizing

- Touch targets: **44pt (iOS) / 48dp (Android)** minimum for any interactive
  control. 24dp is the WCAG 2.5.8 legal floor, not the design target.
- Where the visible element is smaller than the target (an icon button, a small
  glyph), expand the touch area with `hitSlop` rather than shrinking the target.
  Never make the pressable the size of the glyph.
- Adjacent targets need ~8dp of clear space minimum.

## Structure

- One primary action per screen. Everything else is `secondary`, `outline` or
  `ghost`.
- Group related controls with a shared bounded region (a card, a panel).
  Common region overrides proximity as a grouping cue — this is why cards
  work.
- Order matters: destructive actions never sit where a confirm action usually
  is.

## Anti-patterns that will be blocked

```tsx
<Pressable onPress={...}><Text>Save</Text></Pressable>  // OK — a real control...
<View onTouchEnd={...}>                 // ...but a bare View handler is invisible to
                                        //   assistive tech — use Pressable + a role
<TextInput placeholder="Email" />       // placeholder is not a label — add
                                        //   accessibilityLabel + a visible <Text> label
<Image source={...} />                  // core Image with no a11y label; prefer
                                        //   expo-image and set accessibilityLabel / alt
// removing the focus ring for keyboard / switch users without a replacement
```

## Images and icons

- Use **`expo-image`** for anything non-trivial: memory + disk caching,
  `placeholder` (blurhash/thumbhash), `contentFit`, `priority`, and
  `recyclingKey` for list cells. `priority` here is a legitimate, supported prop —
  it is **not** the retired web `next/image` `priority` rule (`DS-009` is N/A in
  RN). API specifics are version-specific — **(verify current)**.
- Every meaningful image needs an accessible label (`accessibilityLabel`, or
  `alt` where the component accepts it). Decorative images are marked
  `accessibilityElementsHidden` / `importantForAccessibility="no"` so assistive
  tech skips them.
- Size the source to the target. A 4000px photo drawn into a 200dp thumbnail
  wastes decode time and memory.
- Fonts load through **`expo-font`** (bundled, held behind the splash until
  ready) — never a web `next/font` import. Register the family names in the
  NativeWind config so `display` / `body` resolve.

## Icons

Use a vector icon set (e.g. `lucide-react-native` / `@expo/vector-icons` — verify
current), not emoji. Decorative icons are hidden from assistive tech. An icon
that is the only content of a control needs an accessible name on the control:

```tsx
<Button accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
  <X importantForAccessibility="no" accessibilityElementsHidden />
</Button>
```

Never use emoji as an interface icon — rendering varies by platform, tone is
unpredictable, and screen readers announce them literally.
