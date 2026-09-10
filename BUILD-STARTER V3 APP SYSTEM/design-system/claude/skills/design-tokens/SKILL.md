---
name: design-tokens
description: Derive, generate and verify the project's design token system from DESIGN-CONTRACT.md. Use after design-direction and before building any component. Also use when the brand colour changes, when contrast fails, or when theme.ts has drifted from the contract.
allowed-tools: Read Write Edit Bash Glob
---

# Design tokens

## Current contract

!`test -f DESIGN-CONTRACT.md && sed -n '1,40p' DESIGN-CONTRACT.md || echo "MISSING — run /design-intake first."`

## Generate

Tokens are **derived, never hand-picked**:

```bash
node tools/token-gen.mjs --out theme.ts
```

The generator reads the contract, builds an 11-step OKLCH ramp with tapered
chroma, biases the neutrals toward the brand hue, **solves** every foreground for
its contrast target rather than guessing, and refuses to write if any semantic
pair fails.

The output is **`theme.ts`**, not a stylesheet. React Native cannot evaluate
`oklch()` or `color-mix()` at runtime, so the generator does the perceptual work
in OKLCH and emits **resolved hex** — light and dark objects — plus the dp sizing
scale. `theme.ts` is the single source of truth; the **NativeWind config**
(`tailwind.config.js`, which NativeWind reads — verify current) maps those values
onto utility classes so components style with `className`.

Then verify what actually landed on disk:

```bash
node tools/contrast-audit.mjs --file theme.ts
```

## Wire the fonts

Fonts are bundled and loaded with `expo-font` before the first screen paints;
hold the splash until they are ready so text never flashes in the fallback and
reflows. Register the family names in the NativeWind config so `display` and
`body` resolve to them.

```tsx
// e.g. app/_layout.tsx (or a shared fonts module)
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";

SplashScreen.preventAutoHideAsync();

export function useAppFonts() {
  const [loaded] = useFonts({ Fraunces_600SemiBold, Inter_400Regular, Inter_600SemiBold });
  if (loaded) SplashScreen.hideAsync();
  return loaded;              // gate the root render on this
}
```

```js
// tailwind.config.js — NativeWind
theme: { extend: { fontFamily: {
  display: ["Fraunces_600SemiBold"],
  sans:    ["Inter_400Regular"],
} } }
```

Rules: ship the named weights you use (variable-font axis support in RN is
inconsistent — verify current); load each face once at app start and gate the
first render on it; always declare a real fallback (the platform system font).

## What you must not do

- Do not hand-edit colour values in `theme.ts`. Change the contract and
  regenerate. Hand-edits bypass the contrast guarantee and will be caught by gate
  G3.
- Do not put a colour in a component. If a token is missing, add the token **pair**
  (surface + `-foreground`) to `theme.ts` and expose it through the NativeWind
  config.
- **One source of truth.** Do not duplicate a value that already lives in
  `theme.ts` — the NativeWind config references it; a component never re-declares
  it. `DS-019`.

## Adding a semantic token

Add the pair to both themes in `theme.ts`, then expose it in the NativeWind
config — always all of it:

```ts
// theme.ts
export const light = { warning: "#F6C34A", warningForeground: "#3A2A12", /* … */ };
export const dark  = { warning: "#8A6A1F", warningForeground: "#FBF6EC", /* … */ };
```

```js
// tailwind.config.js
colors: {
  warning: "var(--warning)",                       // or map light/dark via your
  "warning-foreground": "var(--warning-foreground)", // theme provider (verify current)
}
```

Then re-run `contrast-audit.mjs` and confirm the new pair passes in **both**
themes before using it.

## Definition of done

- [ ] `theme.ts` generated, not hand-written
- [ ] `contrast-audit.mjs` reports zero failures in both light and dark
- [ ] Reduced-motion honoured at the OS flag (not a global stylesheet)
- [ ] Fonts wired through `expo-font` and registered in the NativeWind config
- [ ] No token value duplicated outside `theme.ts` (one source of truth)
- [ ] `node tools/gate.mjs` passes G2 and G3
