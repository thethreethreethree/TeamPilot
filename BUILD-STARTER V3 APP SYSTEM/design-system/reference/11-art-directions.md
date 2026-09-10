# Art direction library

Twelve directions. Each is a **complete system**, not a mood — type pairing,
colour logic, layout thesis, motion character, and what it is wrong for.

Pick by what the intake established, never by what sounds appealing. The
"wrong for" line is the most useful part of each entry: a direction that fits
everything fits nothing.

**All twelve keep the same conventional structure** — platform-standard
navigation (a tab bar where users expect one), familiar form and gesture
behaviour, controls where the OS puts them. They differ only in surface. That is
the whole strategy: conventional structure, distinctive surface.

---

## `editorial-serif`

**Signals** authority, considered, long-form, established.

| | |
|---|---|
| Display | A real text serif with character — Fraunces, Newsreader, Instrument Serif, GT Sectra |
| Body | A neutral sans at 17–18px, or the serif's own text cut |
| Colour | Warm paper neutral, one deep ink, one restrained accent |
| Layout | Asymmetric single column, generous margins, drop caps or standfirsts, pull quotes that actually pull |
| Motion | Almost none. Fades only. Stillness is the statement. |
| Scale | High contrast — 4–5× between display and body |

Serif body text on screen is now legibility-neutral on high-DPI displays. The
old "sans is more legible on screen" rule was a rasterisation artefact of
72–96dpi and no longer applies.

**Wrong for:** dense dashboards, anything with heavy data density, audiences
scanning for a single fact.

---

## `technical-mono`

**Signals** precision, engineering credibility, no marketing gloss.

| | |
|---|---|
| Display | A mono at large sizes — JetBrains Mono, Berkeley Mono, or a grotesque with mono accents |
| Body | Neutral sans, tight leading |
| Colour | Near-black ground or stark white, one signal colour, hairline rules |
| Layout | Visible grid, dense information, tables treated as first-class, generous use of rules and labels |
| Motion | Instant state changes. Nothing eases in. |
| Scale | Low contrast — hierarchy from weight and rules, not size |

The strongest counter-position to soft rounded SaaS styling, and cheap: fast,
accessible, and reads as authored rather than generated.

**Wrong for:** consumer lifestyle, anything selling warmth or care, low-literacy
audiences.

---

## `warm-humanist`

**Signals** approachable, human, service, care.

| | |
|---|---|
| Display | Humanist sans with real personality — Söhne, Untitled Sans, Signifier for contrast |
| Body | The same family's text weight |
| Colour | Warm neutrals (hue 40–80), one saturated warm accent, soft shadows |
| Layout | Generous padding, rounded but not childish (radius 0.5–0.75rem), photography of actual people |
| Motion | Gentle ease-out, 240ms, subtle scale on press |
| Scale | Moderate — 2.5–3× |

**Wrong for:** technical B2B where warmth reads as unserious; anything where
speed of scanning beats comfort.

---

## `brutal-grid`

**Signals** confident, cultural, design-literate, unafraid.

| | |
|---|---|
| Display | Heavy grotesque or a display face with strong quirks |
| Body | Plain grotesque, small |
| Colour | Two flat colours, no gradients, hard edges, high contrast |
| Layout | Exposed grid, thick rules, deliberate misalignment against a real underlying grid, overlap |
| Motion | Hard cuts, no easing, or one deliberate mechanical transition |
| Scale | Extreme — 6×+ between display and body |

Deliberate misalignment only works over a *real* grid. Without one it reads as
a mistake, which is why this is hard to fake.

**Wrong for:** anything requiring trust with money or health; older audiences;
high-anxiety contexts.

---

## `quiet-luxury`

**Signals** premium, restrained, expensive, unhurried.

| | |
|---|---|
| Display | A refined serif or a high-contrast didone, set small and wide-tracked |
| Body | Neutral sans, generous leading (1.7+) |
| Colour | Near-monochrome, one metallic-adjacent warm neutral, deep shadow |
| Layout | Enormous whitespace, small type, centred *sparingly*, full-bleed photography |
| Motion | Slow fades, 400–600ms, parallax only if reduced-motion is honoured |
| Scale | Low contrast, small absolute sizes |

The failure mode is emptiness without confidence. Restraint requires precision
in spacing and type — this direction punishes sloppiness more than any other.

**Wrong for:** anything with more than ~15 screens of content; utility products;
price-sensitive positioning.

---

## `data-dense`

**Signals** capable, professional, built for people who use it all day.

| | |
|---|---|
| Display | Neutral sans, moderate weight |
| Body | 14px with 16px minimum for reading passages |
| Colour | Low-chroma greys, semantic colour reserved strictly for state |
| Layout | Tight rhythm (8dp), persistent tab/section navigation, tables and dense lists, filters one tap away |
| Motion | Instant, or 100ms at most. Latency is the enemy. |
| Scale | Very low contrast — hierarchy from weight, rules and position |

On a large screen keep filters visible; on a phone the filter tray with an
explicit "Apply" outperforms inline-expand and separate screens. Either way,
applied filters stay visible and individually removable.

**Wrong for:** marketing pages, first-touch acquisition, anything sold on
emotion.

---

## `soft-organic`

**Signals** wellbeing, calm, natural, non-technical.

| | |
|---|---|
| Display | Rounded or humanist serif |
| Body | Humanist sans, generous leading |
| Colour | Desaturated greens/terracotta/sand, low chroma, no pure white ground |
| Layout | Curved section dividers, botanical or material texture, asymmetric |
| Motion | Slow, organic easing, gentle scroll reveals |
| Scale | Moderate |

Use real material texture (grain, paper, halftone). Avoid blob shapes — those
are 2020 landing-page vernacular and now read as dated.

**Wrong for:** finance, security, anything where softness undermines
credibility.

---

## `high-contrast-dark`

**Signals** focus, craft, developer-adjacent, night-native.

| | |
|---|---|
| Display | Grotesque or mono |
| Body | Sans, slightly increased letter-spacing (light on dark needs it) |
| Colour | True dark ground (not grey), one luminous accent, surfaces by lightness step |
| Layout | Card surfaces distinguished by lightness rather than borders |
| Motion | Precise, fast, glow or lightness transitions |
| Scale | Moderate to high |

**Design dark-first**, then derive light. Inverting a light theme produces the
characteristic muddy result — dark mode needs *lower* chroma and *different*
lightness relationships, not the same values flipped.

Light text on dark grounds benefits from slightly heavier weight and slightly
looser tracking. WCAG 2's contrast model is known to be weak at the dark end;
check APCA as an advisory second opinion.

**Wrong for:** print-adjacent brands; audiences over ~60; long-form reading.

---

## `swiss-systematic`

**Signals** rigorous, neutral, timeless, institutional.

| | |
|---|---|
| Display | Neue Haas / Helvetica lineage, or a precise grotesque |
| Body | Same family |
| Colour | Black, white, one red or one blue. Nothing else. |
| Layout | Strict modular grid, flush-left ragged-right, mathematical spacing |
| Motion | None, or one precise slide |
| Scale | Systematic — every size from one ratio, no exceptions |

**Wrong for:** brands needing warmth or distinctiveness in a crowded neutral
category — this can read as generic if the execution is not precise.

---

## `archival-print`

**Signals** heritage, craft, provenance, made by hand.

| | |
|---|---|
| Display | An old-style serif, or a wood-type slab |
| Body | Old-style serif or a warm sans |
| Colour | Aged paper, ink black, one spot colour behaving like real spot ink |
| Layout | Print artefacts — registration marks, rules, letterpress texture, visible seams |
| Motion | Page-turn or none |
| Scale | High contrast, print-derived |

Materiality is the point: grain, imperfection and visible process read as
authorship precisely because generative tools default to clean output.

**Wrong for:** anything selling newness or speed; technical products.

---

## `kinetic-minimal`

**Signals** modern, crafted, product-led, confident.

| | |
|---|---|
| Display | Clean grotesque, tight tracking, large |
| Body | Same family, small |
| Colour | Monochrome plus one accent, flat |
| Layout | Very simple, near-empty, carried by one orchestrated motion moment |
| Motion | **This is the direction's entire thesis** — one sequence, executed precisely |
| Scale | High |

The rule that makes this work: **one** motion moment, not motion everywhere.
Scattered animation reads as generated; a single orchestrated sequence reads as
designed. It must degrade to a static, complete screen under reduced motion.

**Wrong for:** content-heavy apps; low-end device audiences; anyone with a
tight performance budget.

---

## `utility-first`

**Signals** honest, fast, no nonsense, public-service.

| | |
|---|---|
| Display | System stack or one workhorse sans |
| Body | Same, 18px, high line-height |
| Colour | Black on white, one link blue, one error red |
| Layout | Single column, wide measure, big touch targets, no decoration |
| Motion | None |
| Scale | Moderate, functional |

Modelled on government service design. Ugly by award standards, and frequently
the highest-converting option for transactional or high-anxiety tasks.

Choose it deliberately, not by default — "no decoration" is a decision that
must fit the audience, not an excuse to skip the design work.

**Wrong for:** brand-led positioning; premium pricing; anything sold on
desirability.

---

## Choosing

Work through these in order. The first three usually decide it.

1. **What is the reader's state of mind?** Urgent and anxious → `utility-first`
   or `data-dense`. Browsing and receptive → almost anything else.
2. **How much real content exists?** Under ten screens → directions that use
   space well (`quiet-luxury`, `kinetic-minimal`, `editorial-serif`). A lot →
   `data-dense`, `swiss-systematic`, `technical-mono`.
3. **What does the category already look like?** Move away from it — but only
   as far as the audience's trust allows.
4. **What is the one bold move?** If the direction does not obviously suggest
   one, it is not the right direction for this project.

## Combining

Two directions can be blended when one governs **structure** and the other
governs **surface** — `data-dense` structure with `technical-mono` surface is
coherent. Blending two surfaces is not: `quiet-luxury` plus `brutal-grid`
produces confusion, not tension.

Record the blend explicitly in the contract as `primary + secondary`, and name
which one owns which layer.
