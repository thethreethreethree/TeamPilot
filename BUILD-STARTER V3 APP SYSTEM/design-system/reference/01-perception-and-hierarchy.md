# Perception, hierarchy and composition

## Why anything looks good

Two findings dominate the aesthetics literature, and they pull in opposite
directions. Understanding the tension is the whole job.

**1. Low visual complexity predicts appeal.** Negative, roughly linear, and the
strongest single predictor. `[STRONG]`

**2. Prototypicality predicts appeal.** Comparably or more powerful — effect
sizes up to η²p = .81. Typical-looking things are rated attractive. `[STRONG]`

Both operate through **processing fluency**: things that are easy to perceive
feel good, and people misattribute that ease to the object rather than to their
own perception.

The trap: optimising purely for fluency produces the maximally typical, minimally
memorable screen — which is exactly what generative systems default to. Fluency
buys you "fine". Memorability requires a deliberate, *scarce* violation of it.

**The resolution:** conventional structure (fluency), distinctive surface
(memorability). See §4 of the manual.

## Grouping

Ranked by evidence:

| Principle | Grade | What it does |
|---|---|---|
| **Common region** | `[STRONG]` | Elements inside a shared boundary group together — and this **overrides proximity** when they conflict. The empirical basis for cards and panels. |
| **Proximity** | `[STRONG]` | Closer elements group. The only principle with a validated quantitative model: grouping strength decays with *relative* distance. |
| **Similarity** | `[STRONG]` for colour/size | Shared visual properties imply shared meaning. Weaker and more stimulus-dependent for shape. |
| **Continuity** | `[MODERATE]` | Alignment creates implied lines the eye follows. Why a broken alignment reads as an error. |
| **Figure/ground** | `[STRONG]` | Contrast, overlap and elevation establish what is in front. |
| **Closure** | `[MODERATE]` | The mind completes implied shapes — why partial bleeds suggest continuation. |

**The operational consequence:** space *between* groups must visibly exceed
space *within* them. A 4px difference does not register. Use a full step of the
scale.

Because common region beats proximity, a card boundary can group things that
are far apart — and can accidentally group things you meant to separate. Check
what your boundaries are actually claiming.

## Hierarchy

Ordered by strength `[STRONG]`:

1. **Position** — top-left in LTR reading order carries the most weight
2. **Size** — the most obvious lever, and the most abused
3. **Contrast** — including against the local background, not just globally
4. **Weight** — often sufficient where size would be crude
5. **Colour** — powerful but expensive; every accent spends scarcity
6. **Isolation / whitespace** — the most sophisticated, and the most reliable

Notice that whitespace is last on the list of *tools* and first in terms of
craft. Emphasising by adding is easy; emphasising by removing everything else
is what separates competent from good.

### The squint test

`[CONVENTION]`, but the single most useful practical check. Blur the screen until
type is illegible. What still reads should be exactly the three things that
matter, in the intended order. If everything survives, nothing is emphasised.

### One primary

Because distinctiveness is **relational**, not absolute. An element is not
memorable because it is bright; it is memorable because it is bright where
nothing else is. `[STRONG]`

This is the strongest empirical argument for a single primary CTA per view, and
it is a stronger argument than "it looks cleaner".

## Scanning

**The F-pattern is a symptom, not a target.** `[STRONG]` — and this is the
finding most often inverted in design writing. F-scanning happens when text is
poorly formatted: no subheads, no lists, no front-loaded information. NN/g's own
conclusion is that it is *bad for users and businesses*.

The correct response is to **fix the formatting** so scanning is unnecessary —
subheads that carry the argument, front-loaded first words, bulleted lists,
bolded key phrases — not to arrange the layout to accommodate an F.

**Banner blindness** `[STRONG]` — content in the top ~100px and anything shaped
like an advertisement is systematically skipped. Do not put important content in
a full-width coloured strip at the very top.

## Composition

`[CONVENTION]` from here — craft, not findings, and still worth following.

- **Asymmetry creates tension; symmetry creates calm.** Centre everything and
  you remove the tool hierarchy depends on. Centre deliberately, in short
  passages, for emphasis.
- **Optical alignment beats mathematical alignment.** Round shapes need to
  overshoot their box; punctuation hangs outside the measure; a capital-height
  cap looks smaller than the same measurement on a round letter.
- **Scale contrast is the cheapest drama available.** 4×+ between display and
  body reads as confident. 1.5× reads as indecisive.
- **Deliberate emptiness reads as confidence** only if everything else is
  precise. Restraint punishes sloppiness — this is why minimal directions are
  harder, not easier.

## Trust and credibility

Design quality is the dominant factor in credibility judgements — people judge
credibility visually far more than they evaluate content `[MODERATE]`. What
actually moved credibility ratings:

- Visual design quality and professionalism
- Real, specific, verifiable information — named people, real addresses
- Currency: visibly recent updates
- Absence of errors: broken links, typos, and stale content are read as
  incompetence and generalise to the whole organisation

Fabricated proof — invented statistics, fake testimonials, logo walls for
non-clients — is banned here for ethical reasons, and it is also the thing most
likely to be caught and destroy the credibility it was faking.
