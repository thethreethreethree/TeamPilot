# Colour

## Author in OKLCH

Every token, every time.

HSL's lightness axis is not perceptually uniform. `hsl(60 100% 50%)` (yellow)
and `hsl(240 100% 50%)` (blue) claim the same lightness and differ enormously in
perceived brightness. A ramp built by stepping HSL lightness produces uneven,
muddy mid-tones and unpredictable contrast.

OKLCH's `L` maps to *perceived* lightness. Equal steps look equal. Contrast
behaves predictably across hues. This is why Tailwind moved its entire default
palette to `oklch()`.

**On device you ship resolved colours, not `oklch()`.** React Native styles
take hex / `rgba()` (and `PlatformColor()` for native system colours); they do
not evaluate `oklch()` or `color-mix()` at runtime. So author the ramp in OKLCH
at *generation* time and let the generator solve, mix and taper there, then emit
final hex into `theme.ts`. The perceptual reasoning below still governs how the
ramp is built — the runtime simply receives the resolved values. (verify current
RN colour-format support)

## Building a ramp

Generated, never hand-picked: `node tools/token-gen.mjs`.

Two rules hand-built ramps consistently get wrong:

**Chroma must taper at both ends.** Holding chroma constant across a lightness
ramp pushes the lightest and darkest steps outside sRGB, where they get clipped.
That clipping is what makes generated palettes look chalky at the top and muddy
at the bottom. The generator uses a chroma envelope peaking around steps 500–600
and falling to ~13% at step 50 and ~44% at 950.

**Neutrals carry the brand hue.** A pure `#808080` beside a saturated brand
colour reads as unconsidered. Chroma ≈0.006–0.012 on the brand hue reads as
chosen. This is the cheapest single upgrade to a palette.

Optional: a small negative `hueShift` (−4 to −8°) across the ramp keeps dark
steps from going cold; positive warms them.

## Contrast

| Pair | Minimum | SC |
|---|---|---|
| Body text | 4.5:1 | 1.4.3 AA |
| Large text — ≥24px, or ≥18.66px bold | 3:1 | 1.4.3 AA |
| UI components, focus indicators, meaningful icons | 3:1 | 1.4.11 AA |
| Enhanced body text | 7:1 | 1.4.6 AAA |

Two details tools routinely get wrong:

- **Truncate, never round.** 4.499:1 fails 4.5:1. W3C is explicit that computed
  values must not be rounded up.
- **14pt bold is 18.5–18.66px**, not 18px. W3C states "approximately 18.5px";
  14 x 1.333 = 18.66. Take the stricter figure. Many tools use a flat 18px and
  quietly pass failing text.

Exempt from 1.4.3: incidental text, disabled controls, and **logotypes** — text
in a logo has no contrast requirement.

## APCA

The Accessible Perceptual Contrast Algorithm outputs a signed lightness contrast
`Lc` rather than a ratio, and is polarity-sensitive.

**Status, which matters:** APCA is **not** in WCAG 3. It was pulled from the
July 2023 Working Draft after failing to reach consensus, and does not appear in
the March 2026 draft. The WCAG 3 contrast algorithm is undetermined. No legal or
standards regime accepts APCA anywhere.

**Use it as an advisory second opinion**, because it genuinely models dark-mode
and thin-type legibility better than WCAG 2's relative-luminance ratio, which is
known to be weak at the dark end. `contrast-audit.mjs` reports it alongside the
ratio. **Never gate on it.**

Use-case guidance (not compliance thresholds): Lc 90 preferred body · **Lc 75
body minimum** · Lc 60 non-body content · Lc 45 large text · Lc 30 spot-readable.

Note the frequently conflated mapping: mathematically, 4.5:1 ≈ Lc 60 and 7:1 ≈
Lc 75. But APCA's *body-text recommendation* is Lc 75, deliberately stricter than
AA. If you see "Lc 75 = AA", that is the use-case number; "Lc 60 = AA" is the
maths. Say which you mean.

## What colour psychology supports

**Supported:**
- Colour meaning is **contextual**. The same hue carries opposite meanings in
  different contexts. The academically respectable theory is one that denies
  universal hue→emotion mappings. `[MODERATE]`
- Brand-personality associations: red→excitement, blue→competence, with
  **saturation and lightness carrying independent effects**. `[MODERATE]`
- Warm, saturated colours are more arousing — and **brightness and saturation
  explain far more variance than hue**. `[MODERATE]`
- Preference is ecological and varies enormously by culture and demographic:
  peak preferred colourfulness ranges 3.6–7.6 on a 9-point scale. `[MODERATE]`

**Rejected:**
- "Blue conveys trust" — no primary source. The real finding is blue→*competence*
  in brand-personality ratings, and the effect is confounded with category
  prototypicality (banks already use blue, so blue signals "bank").
- "Colour increases brand recognition by 80%" — untraceable.
- "85% of shoppers cite colour as the primary reason they buy" — untraceable.

## Harmony schemes

Complementary, triadic, split-complementary and tetradic derive from Bauhaus
colour-wheel pedagogy. `[CONVENTION]` — artistic doctrine, not findings, and
they are geometric constructions on a perceptually **non-uniform** wheel.

What research supports is narrower: preference for a pair is dominated by
preference for the individual colours, plus a **hue-similarity** effect. That
partially supports *analogous* schemes and does **not** support complementary
ones as inherently pleasing.

Use a scheme to generate a starting point. Then verify in OKLCH, where equal
angular steps are actually equal perceptual steps.

## Ratios

The 60-30-10 rule is `[FOLKLORE]` — no author, no study, no origin paper.

The underlying idea holds on other grounds: one dominant neutral, one supporting
hue, one scarce accent produces clear figure-ground separation, keeps the accent
scarce (isolation effect — distinctiveness is relational), and keeps colour
complexity low, which is the strongest predictor of appeal.

**Keep the practice. Drop the numbers.**

## Dark mode

Design dark-first if the direction calls for it, then derive light. Inverting a
light theme produces the characteristic muddy result.

- Dark mode needs **lower chroma**, not the same values flipped. Saturated
  colours on dark grounds vibrate.
- Use a true dark ground, not grey. Distinguish surfaces by lightness step
  rather than by borders.
- Light text on dark benefits from slightly heavier weight and slightly looser
  tracking.
- The primary surface must move *lighter* on a dark ground — the generator
  walks three ramp steps up.
- WCAG 2's model is weakest at the dark end. Check APCA as a second opinion.

## Never colour alone

WCAG 1.4.1. Around 8% of men have a colour-vision deficiency. Every state
signalled by colour also carries an icon, a label, or a shape.
