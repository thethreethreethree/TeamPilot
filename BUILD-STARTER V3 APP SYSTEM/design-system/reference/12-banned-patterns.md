# Banned patterns

Each may be waived only by an entry under `waivers:` in `DESIGN-CONTRACT.md` with
a written reason. "The client asked for it" is a record, not a justification —
write what makes it acceptable here *despite* the rule.

---

## The generated-design tells

These are the specific things that make a screen read as machine-produced. They
are banned because they are exhausted, not because they are incompetent.

| ID | Pattern | Why |
|---|---|---|
| `BAN-01` | Purple→blue gradient hero | The single strongest tell. "Purple gradients, Inter, cards on white" is the documented shorthand for the AI look. |
| `BAN-02` | Glassmorphism on large surfaces | Aesthetically exhausted, and the `BlurView` behind it is a real per-frame cost on low-end devices. Permitted on a nav bar or a sheet, not full-screen. |
| `BAN-03` | Bento grid as the whole screen | Performs fine, aesthetically spent. Allowed as one section, never as the layout thesis. |
| `BAN-04` | Outline-icon-in-rounded-square feature triplet | The default template shape. Carries no information about this client. |
| `BAN-05` | Uniform grey "Trusted by" logo wall | Decorative, unverifiable, universally ignored. If the logos are real and matter, treat them as content with context. |
| `BAN-06` | Blob / amoeba background shapes | 2020 landing-page vernacular. Never migrated to real product surfaces. |
| `BAN-09` | AI-generated hero illustration in current house styles | Dates instantly and reads as filler. |
| `BAN-10` | Emoji as section markers or icons | Platform-dependent rendering, unintended tone, announced literally by the screen reader. |
| `BAN-11` | Everything centred | Centre-alignment throughout removes the asymmetry hierarchy depends on. |
| `BAN-12` | Inter as the **display** face | Not a quality judgement — Inter is excellent for UI and body. Banned for display because it carries no voice. Same for Poppins, Montserrat, Space Grotesk as defaults. |

## Banned on evidence, not taste

| ID | Pattern | Why |
|---|---|---|
| `BAN-07` | Kinetic typography hero | Fights screen readers, and animated text that reflows janks. Rarely survives to production. |
| `BAN-08` | WebGL / 3D hero as a centrepiece | Wins galleries, drains battery and stutters on low-end devices; heavy memory and GPU cost before the screen is usable. Needs an explicit performance-budget waiver. |
| `BAN-13` | Auto-rotating carousel | WCAG 2.2.2 failure, and engagement past slide one is close to zero. If you need a carousel, it does not auto-advance. |
| `BAN-14` | Lorem ipsum in a committed file | Hides the layout failures only real content reveals. |

## Structural bans — app

| Pattern | Why |
|---|---|
| Hamburger/drawer as the only navigation when a tab bar would fit | >20% discoverability loss, ≥39% slower tasks. 3–5 top-level destinations belong in a visible tab bar. `DS-020`. |
| Touch target below 44pt (iOS) / 48dp (Android) | Missed taps and a WCAG 2.5.8 concern. Pad the `Pressable` or extend `hitSlop`; never a control the size of its glyph. |
| Hover-only affordance | Hover is pointer-only and never fires on touch. Meaning or an action revealed only on hover is invisible to the finger. |
| Gesture-only action with no visible fallback | Swipe-to-delete, long-press or a hidden gesture as the *only* route strands switch and screen-reader users. Always offer a visible, accessible equivalent (WCAG 2.5.7). |
| Blocking splash or full-screen spinner as the default first experience | A fixed-length splash, or a spinner covering the first screen, reads as slow. Hold the splash only to first meaningful paint; prefer skeletons. |
| Ignoring safe-area insets | Content under the notch, dynamic island, home indicator or status bar. Use `react-native-safe-area-context`; never hard-code a status-bar height. |
| Permission prompt on launch with no rationale | Firing the OS camera/location/notification prompt cold, before the user understands why, tanks the grant rate and can bury the app. Ask in context, after a plain-language explanation. |
| Placeholder used as a label | Fails on memory, contrast, screen-reader exposure and error recovery. `DS-005`. |
| No visible focus state for hardware-keyboard / switch / D-pad users | WCAG 2.4.7. Touch does not need it; keyboard/switch/TV input does. `DS-004`. |
| `View` with `onPress` and no role or label | Invisible and unusable to the screen reader. Use `Pressable` with `accessibilityRole` and a label. `DS-006`. |
| Raw colour literals in components | Bypasses the token layer and the contrast gate. Use a token. `DS-001`. |
| Ad-hoc inline `style` overriding a token or variant | The system has already been bypassed at the call site — add a variant instead. `DS-012`. |
| Tokens defined in two places | A value hard-coded in a component that also lives in `theme.ts` / NativeWind config. One source of truth. `DS-019`. |
| Colour as the sole state signal | WCAG 1.4.1. ~8% of men have a CVD. |

---

## The Awwwards caveat

Award galleries and evidence-based UX are different disciplines with different
objective functions. Galleries reward novelty, technical ambition and immersion,
judged by designers on high-end devices. Everything in the evidence base — low
visual complexity as the top predictor of appeal, prototypicality second, visible
navigation, fast response — points the other way for an app that has to work.

**Take visual vocabulary from award work. Never take interaction architecture
from it.**

---

## What to do instead

The directions in `11-art-directions.md` are the sanctioned alternatives.
Broadly:

- **Typography over decoration.** A real display face with a considered scale
  differentiates more than any effect, and costs nothing in performance or
  accessibility.
- **Material over gradient.** Grain, halftone, print artefacts, visible seams.
  Imperfection reads as authorship precisely because generative tools default to
  clean output.
- **Composition over ornament.** Asymmetry, scale contrast, deliberate emptiness.
- **One motion moment over ambient motion.** An orchestrated sequence reads as
  designed; scattered animation reads as generated.
- **Native idiom over imported chrome.** Platform-conventional navigation,
  controls and gestures where users expect them — spend the distinctiveness on
  surface, not on relearning the shell.
- **Dark-first where it fits.** Genuinely designed dark mode, not an inverted
  light theme — dark needs lower chroma and different lightness relationships, not
  the same values flipped.
