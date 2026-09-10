# Evidence ledger

How to read confidence in this system. A manual that presents folklore and
replicated findings with equal weight teaches an agent to trust the wrong
things, so everything here carries a grade.

| Grade | Meaning |
|---|---|
| `[STRONG]` | Replicated experimental or meta-analytic support |
| `[MODERATE]` | Real studies, limited scope or contested |
| `[CONVENTION]` | Craft practice with no empirical warrant — often still correct |
| `[FOLKLORE]` | Widely repeated, poorly supported. Do not cite. |

---

## The five strongest claims in this system

If you need a spine, use these.

1. **Visual complexity predicts appeal negatively and roughly linearly.**
   Together with colourfulness it accounts for a large share of variance in
   first-impression ratings. `[STRONG]`
   → *When a layout is not working, remove before adding.*

2. **Prototypicality is comparably or more powerful** (η²p up to .81) and
   operates through processing fluency. `[STRONG]`
   → *Conventional structure. But it is a floor, not a ceiling — see §4 of the
   manual.*

3. **Hidden navigation degrades every measured UX metric.** >20% discoverability
   loss, ≥39% task-time penalty, n=179. `[STRONG]`
   → *Visible navigation is not negotiable — a tab bar, not a buried drawer.*

4. **Serif vs sans does not affect screen legibility.** Null across 72+ studies.
   x-height, letter discriminability, size and contrast do. `[STRONG]`
   → *Choose the display face for voice.*

5. **Field count, not step count, drives form abandonment.** Average checkout
   carries 11.3 fields where 8 would do. `[MODERATE-STRONG]`
   → *Cut fields, not steps.*

---

## Grades by area

### Perception
- Gestalt **common region** overriding proximity — `[STRONG]`. This is why
  cards work.
- Gestalt **proximity** — `[STRONG]`, the only principle with a validated
  quantitative model.
- Gestalt **similarity** — `[STRONG]` for colour/size, weaker for shape.
- **Von Restorff / isolation** — `[STRONG]`, and crucially **relational**: an
  item is distinctive relative to its context, so five isolated elements means
  none are.
- **Aesthetic-usability effect** — `[MODERATE]`, and narrower than usually
  claimed: correlational, same-session, and the relationship reverses after
  real use.
- **"50ms first impressions"** — `[MODERATE]` but routinely overstated. The
  study measured visual-appeal ratings of screenshots, not behaviour.

### Interaction
- **Fitts's Law** — `[STRONG]`, but 1-D, models pointing only, and the
  corner/edge argument is desktop-mouse-specific.
- **Hick's Law** — `[STRONG]` in its domain (memorised layouts), `[FOLKLORE]` as
  applied to unfamiliar menus, where search is **linear**.
- **Serial position** — `[STRONG]`, but applies to recall, not recognition.
  Menu items are recognised.
- **Peak-end rule** — `[MODERATE]`, bounded to short aversive episodes. Fails
  for simple positive experiences.
- **Goal-gradient** — `[MODERATE-STRONG]` for quantified rewards with visible
  progress.
- **Miller's 7±2** — `[STRONG]` as Miller stated it, `[FOLKLORE]` as applied to
  navigation.
- **Zeigarnik** — **failed**. 2025 meta-analysis, 38 studies, recall ratio 0.99.
  The surviving effect is *Ovsiankina* (67% task resumption).
- **Tesler's Law** — `[CONVENTION]`. An economic argument, not a measured law.
  Honest and useful; label it as ethic, not finding.

### Colour and type
- **Colour meaning is contextual** — `[MODERATE]`. The respectable theory is
  one that denies universal hue→emotion mappings.
- **Brand-personality hue associations** — `[MODERATE]`. Red→excitement,
  blue→competence, with saturation and lightness carrying independent effects.
- **"Blue = trust"** — `[FOLKLORE]`. No primary source; confounded with
  category prototypicality.
- **Colour harmony schemes** — `[CONVENTION]`. Bauhaus pedagogy. Research
  favours hue *similarity*, which supports analogous, not complementary.
- **60-30-10** — `[FOLKLORE]`. No traceable source. Underlying logic is sound.
- **Typeface personality** — `[MODERATE]` by category; sans faces rate neutral
  on every trait. Personality does **not** reliably transfer to the text.
- **45–75 character measure** — `[CONVENTION]`. Bringhurst, about print,
  hedged as "widely regarded". Screen studies conflict.
- **line-height 1.5** — `[CONVENTION]`. A standards floor, not a measured
  optimum.

### Standards (not evidence — law)
- WCAG 2.2 is the current W3C Recommendation, and ISO/IEC 40500:2025 since
  October 2025. 2.0, 2.1 and 2.2 are all simultaneously live.
- The **legally cited** baseline in the US Title II rule and the currently
  cited EN 301 549 is still **2.1 AA**. 2.2 is a superset — build to it.
- **APCA is not in WCAG 3.** Removed July 2023; absent from the March 2026
  draft. The WCAG 3 contrast algorithm is undetermined. Advisory use only.
- App performance is measured per-platform, not by one cross-platform regime:
  cold-start time, sustained **60fps** (frame budget ~16.7ms; 120fps ≈ 8.3ms on
  ProMotion), scroll jank and input latency. Android Vitals (Play Console) and
  iOS MetricKit report field numbers; there is no web-CWV-style single p75
  standard for native apps (verify current).

---

## How to handle a contested claim

1. State what the evidence actually shows, including the disagreement.
2. Make the design decision anyway — uncertainty is not an excuse for
   paralysis.
3. Record which way you went and why, in the contract.

Never manufacture false confidence by picking the study you prefer and
presenting it as settled. Where two good studies conflict — as they do on line
length — say so and pick on other grounds.
