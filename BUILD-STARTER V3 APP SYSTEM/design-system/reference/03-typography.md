# Typography

## The settled question

**Serif vs sans-serif makes no reliable difference to screen legibility.** A
critical review of 72 studies concluded there is no valid conclusion favouring
either. `[STRONG null]`

What actually predicts legibility `[STRONG]`:

1. **x-height relative to size** — dominates typeface category entirely
2. **Letter discriminability** — how distinct `I l 1`, `O 0`, `rn m` are. This
   is what Inter, Public Sans and Atkinson Hyperlegible actually solve.
3. **Absolute size at viewing distance** — critical print size ≈0.2° of visual
   angle; below it reading degrades fast, above it speed plateaus
4. **Contrast**
5. **Line length and leading** — better supported than typeface choice

**Therefore: choose the display face for voice.** Serif body text on modern
high-DPI screens is a defensible, differentiated choice. The "sans is more
legible on screen" rule was a rasterisation artefact of 72–96dpi displays and
no longer applies.

Also rejected: "serifs guide the eye along the line" and "serifs bind words
together" — post-hoc rationalisations with no support. And "hard-to-read fonts
improve learning", which failed a large multi-site replication.

## The scale

One ratio. Nothing between its steps. A single off-scale size is enough to make
a screen read as unresolved.

Default 1.25 (major third) from 16px:

| Token | Size | Line-height | Use |
|---|---|---|---|
| `xs` | 12px | 1.45 | Captions, metadata. Never body. |
| `sm` | 14px | 1.6 | Secondary UI, dense tables |
| `base` | 16px | 1.65 | **Body minimum** |
| `lg` | 18px | 1.6 | Lead paragraphs, comfortable body |
| `xl` | 20px | 1.5 | Card titles |
| `2xl` | 24px | 1.35 | h4 |
| `3xl` | 31px | 1.28 | h3 |
| `4xl` | 39px | 1.2 | h2 |
| `5xl` | 49px | 1.15 | h1 |
| `6xl` | 61px | 1.08 | Display |
| `7xl` | 76px | 1.02 | Hero |

The ratio holds strictly from `3xl` upward (31 = 16x1.25^3, then 39, 49, 61,
76). The lower steps are the familiar 12/14/16/18/20/24 UI sizes — interface
text needs finer gradation than display text, so those sit closer together.
A deliberate compromise, not a pure geometric scale.

Ratio choice: 1.25 is safe. 1.333 or 1.5 for drama. Below 1.2 the hierarchy
stops reading.

Line-height shrinks as size grows. A 76px heading at 1.5 is a river of
whitespace; body text at 1.2 is unreadable.

## Hard numbers

Sizes below are in dp — the density-independent unit RN uses (`sp` on Android,
`pt` on iOS); the numbers carry over unchanged.

- **Body ≥ 16dp.** Reading speed degrades below this, and both platform
  guidelines land here — iOS Human Interface body is 17pt, Material body 16sp.
  (The old web reason — mobile Safari zooming the viewport when a sub-16px input
  gains focus — does not apply in a native app.)
- **Line-height ≥ 1.5 for body** — the WCAG 1.4.8 floor.
- **Measure ≤ 75 characters.** WCAG 1.4.8 caps at 80.
- **Never justify.** Rivers, and broken word-spacing.
- **Tracking:** negative on large display (−0.02 to −0.03em), zero on body,
  positive on uppercase labels (+0.08 to +0.12em).

### Honest sourcing on the measure

The "45–75 characters" figure originates with Bringhurst (1992), writing about
**print**, and hedged as "widely regarded" — an appeal to convention, not data.

Screen studies actively conflict. One controlled study found 55 CPL produced the
best comprehension; another found 95 CPL fastest with comprehension flat.
Reading speed, comprehension and stated preference frequently dissociate.

**Treat ≤75 as convention plus an accessibility ceiling, not a measured
optimum.** `[CONVENTION]`

Similarly, line-height 1.5 is a standards-committee floor, not an empirically
derived optimum. Well chosen; not evidence-derived.

## Text must survive scaling

The device equivalent of WCAG 1.4.12: users enlarge text system-wide through
**iOS Dynamic Type** and **Android font scale**, and text must reflow when they
do. Leave `allowFontScaling` on (its default) — never switch it off to protect a
layout — and never pin a text container to a fixed height. Fixed-height text
boxes clipping enlarged type are the usual failure. Test at the largest system
font setting, including the accessibility sizes.

## Pairing

Two families maximum, three with a mono.

Contrast them on an axis that reads: **classification** (serif vs sans),
**weight**, or **width**. Two similar sans faces read as a mistake, not a
pairing.

**Banned as display faces:** Inter, Poppins, Montserrat, Space Grotesk. Not a
quality judgement — Inter in particular is an excellent UI face and is
recommended for body and interface text. They are banned for display because
they carry no voice and are the default of the default.

Good display directions by feel:
- **Editorial authority** — Fraunces, Newsreader, Instrument Serif, GT Sectra
- **Technical** — JetBrains Mono, Berkeley Mono, or a precise grotesque
- **Human warmth** — Söhne, Untitled Sans, Signifier
- **Neutral rigour** — a Helvetica-lineage grotesque, executed precisely

## Typeface personality

Perception is consistent **by category** `[MODERATE]`: serif reads
stable/practical/formal; script reads youthful/creative/casual; display reads
assertive; mono reads plain/conforming.

**Sans-serifs rate neutral on every trait.** You cannot claim a particular
grotesque "conveys confidence" on this evidence.

Two limits worth stating: consistent personality attribution to a typeface does
**not** reliably transfer to perception of the text it sets; and all of this is
rating data, not behaviour — there is no evidence of effects on conversion,
comprehension or recall.

## Font loading

Fonts are bundled with the app, not fetched at runtime. Load them with
`expo-font` before the first screen paints, and hold the splash until they are
ready so text never flashes in the fallback and then reflows.

```tsx
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

Then register the family names in the NativeWind `fontFamily` config / `theme.ts`
so `display` and `body` resolve to these faces.

- **Ship the named weights you use.** Variable-font axis support in RN is
  inconsistent across platforms (verify current) — prefer the static named cuts
  (`_400Regular`, `_600SemiBold`) rather than relying on a single variable file.
- Load each face exactly once, at app start, and gate the first render on it.
- Fonts are packaged into the binary — nothing reaches Google at runtime.
- Always declare a real fallback (the platform system font) so text still renders
  if a face fails to load.
