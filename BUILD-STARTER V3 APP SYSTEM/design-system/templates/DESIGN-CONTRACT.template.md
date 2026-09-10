---
# ─────────────────────────────────────────────────────────────────────
# Machine-read. token-gen.mjs, the hooks and the gate parse this block.
# Keep the keys and shapes exactly. Prose belongs in the body below.
# Placeholders are written in ANGLE BRACKETS and fail gate G1 until replaced.
# ─────────────────────────────────────────────────────────────────────

project: <PROJECT NAME>
client: <CLIENT NAME>
date: <YYYY-MM-DD>

# The art direction id, from reference/11-art-directions.md
direction: <DIRECTION ID>

color:
  # The brand seed. Everything derives from this. Hex or oklch().
  seed: "<#RRGGBB>"
  # Optional second hue for accents. Omit if the brand is monochrome.
  accent: "<#RRGGBB or omit>"
  # Hue for the neutral ramp. Defaults to the seed hue. Never pure grey.
  neutralHue: <0-360>
  # Chroma carried by neutrals. 0.004 = barely tinted, 0.014 = clearly warm/cool.
  neutralChroma: 0.008
  # Degrees of hue rotation across the ramp. 0 = strict. -6 warms the darks.
  hueShift: 0

type:
  display: <DISPLAY TYPEFACE>
  body: <BODY TYPEFACE>
  mono: <MONO TYPEFACE or omit>
  # Ratio between type-scale steps. 1.25 = major third (safe).
  # 1.333 or 1.5 for high drama. Below 1.2 the hierarchy stops reading.
  scaleRatio: 1.25

radius: 0.625          # rem. 0 = hard edges. 1.5 = very soft.

navigation: <tab-bar | tab-bar+stack | stack | modal-heavy | minimal>

voice: <TWO ADJECTIVES, and one anti-adjective>

# Rules deliberately not enforced on this project.
# Each needs a written reason below under "Waivers". An unjustified
# waiver is itself a violation.
waivers: []
---

# Design contract — <PROJECT NAME>

This document is binding. Every visual decision in this project derives from it.
If a build contradicts this contract, the build is wrong.

---

## 1. The business

**In one sentence, what changes for the customer:**
<NOT WHAT THEY SELL — WHAT IS DIFFERENT AFTERWARDS>

---

## 2. Audience

| | |
|---|---|
| Who | <ROLE, CONTEXT> |
| Platform | <iOS / ANDROID / BOTH — with the expected split; phone vs tablet> |
| Prior knowledge | <WHAT THEY ALREADY UNDERSTAND> |
| State of mind on arrival | <COMPARING? URGENT? SCEPTICAL? BROWSING?> |

---

## 3. The one job

**The single primary conversion:** <ONE ACTION>

Secondary actions, in order: <LIST>

> If more than one action is marked primary, the page has no opinion about what
> to do next, and the user inherits that indecision.

---

## 4. Competitive position

| Competitor | What they do well | What we are moving away from |
|---|---|---|
| <URL> | | |
| <URL> | | |

**Category convention:** <WHAT EVERY SITE IN THIS SPACE LOOKS LIKE>

**Where we deliberately break it:** <ONE THING, AND WHY THAT IS SAFE HERE>

---

## 5. Direction

**Chosen:** `<DIRECTION ID>`

**Why this client, specifically:**
<TIE TO TWO CONCRETE INTAKE ANSWERS. NOT "IT LOOKS MODERN".>

**The one bold move:**
<EXACTLY ONE PLACE THIS TAKES A REAL RISK, AND WHERE IT LIVES>

**What stays quiet:**
<WHAT IS DELIBERATELY PLAIN SO THE BOLD MOVE READS>

### Divergence self-check

- [ ] Would this be obviously wrong for the competitors named above?
- [ ] Three decisions that could only apply to this client:
      1. <>
      2. <>
      3. <>
- [ ] Display face is not Inter / Poppins / Montserrat / Space Grotesk
- [ ] No hero gradient, or it is declared below with OKLCH stops and a reason
- [ ] With the logo removed, this is distinguishable from a template

---

## 6. Colour

| Role | Value | Note |
|---|---|---|
| Brand seed | `<#RRGGBB>` | <WHERE IT CAME FROM> |
| Accent | `<#RRGGBB>` | Scarce by design — see below |
| Neutral bias | `<HUE>°` | Never pure grey |

**Accent discipline.** The accent must stay scarce. Distinctiveness is
relational: an element is not memorable because it is bright, but because it is
bright *where nothing else is*. Five accented elements on a page means none of
them read.

Tokens are generated, never hand-picked. The generator emits **`theme.ts`**
(resolved hex + dp scale; the NativeWind config consumes it):

```bash
node tools/token-gen.mjs --out theme.ts
```

**Declared gradients** (leave empty unless genuinely part of the direction):

| Name | Stops (OKLCH) | Where used | Why |
|---|---|---|---|

---

## 7. Typography

| Role | Face | Weights | Where |
|---|---|---|---|
| Display | <> | <> | H1–H3, hero, big numbers |
| Body | <> | <> | Running text, UI |
| Mono | <> | <> | Code, data, technical labels |

**Scale:** <RATIO> from a 16px base.

**Voice in type:** <WHAT THE PAIRING SIGNALS AND WHY IT FITS THIS AUDIENCE>

> Serif vs sans makes no reliable difference to screen legibility — that
> question was settled across 72+ studies. What matters is x-height, letter
> discriminability, size and contrast. So choose the display face for *voice*,
> and stop worrying about the serif question.

---

## 8. Navigation and structure

**Pattern:** <tab-bar | tab-bar+stack | stack | modal-heavy | minimal>

**Tab-bar destinations** (aim 3–5; label quality matters more than count; each
tab owns its own stack):

1. <LABEL> — <WHAT IS BEHIND IT>
2. <>
3. <>

**Depth:** <2 OR 3 LEVELS>

**Overflow:** <"More" tab / grouped list if >5 top-level areas>

**Back / up:** <HEADER BACK + OS BACK GESTURE; EXPLICIT "UP" FOR DEEP-LINK ARRIVALS>

---

## 9. Content reality

Design for these numbers, not the aspirational ones. A layout built for twelve
case studies collapses with two.

| Content type | Real count at launch |
|---|---|
| <PRODUCTS / SERVICES> | <N> |
| <CASE STUDIES / TESTIMONIALS> | <N> |
| <TEAM MEMBERS> | <N> |
| <BLOG POSTS> | <N> |
| <PHOTOGRAPHY AVAILABLE> | <N, AND WHAT QUALITY> |

**Longest plausible strings to test:** <LONGEST PRODUCT NAME, LONGEST HEADING>

---

## 10. Constraints

| | |
|---|---|
| Locales | <> |
| RTL required | <YES/NO> |
| Accessibility target | WCAG 2.2 AA <PLUS ANYTHING EXTRA> |
| Performance budget | Cold start short (measured) · sustained 60fps (16.7ms/frame) · input ack ≤ 100ms · no dropped frames on scroll |
| Min OS versions | <iOS __ / ANDROID API __> |
| Backend / content source | <> |
| Deadline | <> |

---

## 11. Waivers

Each waived rule needs a real reason. "The client asked for it" is a record,
not a justification — write what makes it acceptable here despite the rule.

| Rule ID | Waived because | Approved by | Date |
|---|---|---|---|

---

## 12. Change log

| Date | What changed | Why |
|---|---|---|
| <YYYY-MM-DD> | Contract created | Project start |
