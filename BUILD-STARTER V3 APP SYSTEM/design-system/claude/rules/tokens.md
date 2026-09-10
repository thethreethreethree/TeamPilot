---
paths:
  - "**/theme.ts"
  - "**/theme.tsx"
  - "**/tokens/**"
  - "**/tailwind.config.js"
  - "**/tailwind.config.ts"
---

# Token rules

`theme.ts` is generated. Regenerate it; do not hand-edit colour values.

```bash
node tools/token-gen.mjs --out theme.ts
```

The generator reads `DESIGN-CONTRACT.md`, derives an 11-step OKLCH ramp, picks
foregrounds by **solving** for contrast rather than guessing, and verifies every
semantic pair before it writes. It does the perceptual work in OKLCH and emits
**resolved hex** (React Native cannot evaluate `oklch()` at runtime) plus the dp
sizing scale, as light and dark objects. Hand-edited values bypass that
guarantee.

`theme.ts` is the **single source of truth** (`DS-019`). The NativeWind config
(`tailwind.config.js`, which NativeWind reads — verify current) consumes those
values so components style with `className`; it must never redefine them.

## Colour

Author in `oklch(L C H)`. Never HSL for ramps.

HSL's lightness axis is not perceptually uniform — `hsl(60 100% 50%)` and
`hsl(240 100% 50%)` are nominally the same lightness and differ enormously in
perceived brightness. A ramp built by stepping HSL lightness produces muddy
mid-tones and unpredictable contrast. OKLCH's `L` maps to perceived lightness,
so equal steps look equal and contrast behaves predictably across hues.

OKLCH is a **generation-time** space only. The generator resolves each step to a
hex string and writes that to `theme.ts`; React Native styles carry hex, not
`oklch()`. Never put an `oklch()`, `rgb()` or `hsl()` literal in a `style={{}}`,
a `StyleSheet`, or a NativeWind class.

**Chroma must taper at both ends of a ramp.** Holding chroma constant pushes
the lightest and darkest steps outside sRGB, where they get clipped — this is
what makes generated palettes look chalky at the top and muddy at the bottom.

**Neutrals are never pure grey.** Carry a small chroma (≈0.006–0.012) on the
brand hue. A pure `#808080` beside a saturated brand colour reads as
unconsidered; a hue-biased neutral reads as chosen.

## The semantic layer

Components address tokens, never ramp steps:

```
bg-background   text-foreground
bg-card         text-card-foreground
bg-primary      text-primary-foreground
bg-muted        text-muted-foreground
bg-accent       text-accent-foreground
border-border   ring-ring   bg-input
```

Every surface token has a matching `-foreground`. If you need a colour with no
token, add the pair — do not reach into `brand-600` from a component.

## Required structure

`theme.ts` holds the resolved values; the NativeWind config maps them onto
utility classes. Keep them in that order — config consumes theme, never the
reverse.

```ts
// theme.ts  — generated, resolved hex, light + dark
export const light = {
  background: "#FBFAF7", foreground: "#1A1A1A",
  primary: "#56317E", primaryForeground: "#FFFFFF",
  /* … full semantic set, both surfaces + -foreground … */
};
export const dark = { /* the dark object, same keys */ };

export const space  = { /* dp scale, 4-based */ };
export const radius = { /* dp, derived from one base */ };
```

```js
// tailwind.config.js — NativeWind. References theme.ts; never re-declares a value.
const { light } = require("./theme");
module.exports = {
  theme: { extend: {
    colors: { primary: light.primary, "primary-foreground": light.primaryForeground /* … */ },
    // light/dark swap is wired through your theme provider (verify current for your
    // NativeWind version — dark-variant and CSS-var strategies both exist)
  } },
};
```

Light/dark selection is resolved at runtime by the app (a theme provider reading
the OS colour scheme), not by a `.dark` CSS class. The exact NativeWind mechanism
for dark variants is version-specific — **(verify current)**.

## Scales

| Scale | Rule |
|---|---|
| Spacing | 4dp base. Every value divisible by 4. |
| Type | 1.25 major third from 16 (sp/dp). Nothing between steps. Honour Dynamic Type / `fontScale`. |
| Radius | Derived from one base radius, multiplied into sm…4xl (dp). |
| Z-index | Named layers only: base 0, raised 10, sticky 20, overlay 30, modal 40, toast 50, tooltip 60. |
| Duration | instant 100 · fast 160 · base 240 · slow 400 ms. |

Sizes are **dp** (density-independent pixels), not CSS px or rem — RN resolves
them per-device. Type respects the OS text-size setting, so avoid pinning a
layout to a fixed pixel height that a larger `fontScale` will overflow.

## Contrast is a gate, not a guideline

| Pair | Minimum |
|---|---|
| Body text on its surface | 4.5:1 |
| Large text (≥24dp, or ≥18.66dp bold) | 3:1 |
| UI component boundaries, focus rings, icons carrying meaning | 3:1 |

Ratios are **truncated, never rounded**. 4.499:1 fails 4.5:1. Contrast is checked
in **both** the light and the dark object.

Note the large-text definition: 14pt bold is **18.5–18.66dp** depending on how
you round (W3C says "approximately 18.5px"; 14 x 1.333 = 18.66). Take the
stricter figure. Either way an 18dp bold heading is normal text and needs 4.5:1.

APCA is computed by the auditor as an advisory signal only. It is **not** in
the WCAG 3 draft — it was removed in July 2023 — and has no legal standing.
Never gate on it.

## Verify what landed

After generating, verify the emitted file rather than trusting the generator:

```bash
node tools/contrast-audit.mjs --file theme.ts
```

## Reduced motion

There is no CSS `prefers-reduced-motion` block in React Native. Reduce Motion is
honoured **in code**, per animation, by reading the OS flag — so it is verified
**on-device**, not by a stylesheet the gate can grep (`DS-016`).

```tsx
import { useReducedMotion } from "react-native-reanimated";
// or AccessibilityInfo.isReduceMotionEnabled() / the reduceMotionChanged event

const reduceMotion = useReducedMotion();
// when true: skip or near-zero the animation, never strand a callback waiting
// on an animation that never runs.
```

Confirm it on a device with Reduce Motion enabled. A near-instant transition is
safer than `0` for anything that resolves on an animation-complete callback.
