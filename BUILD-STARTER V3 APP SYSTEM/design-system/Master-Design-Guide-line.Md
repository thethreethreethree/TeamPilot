# Master Design Guide Line

**A build manual for AI agents producing native mobile apps.**
Version 1.0.0 · Expo · React Native · NativeWind · expo-router · EAS · iOS + Android

---

## 0. How to read this document

This is not inspiration. It is a **specification with enforcement**. Every rule
here is either checked by a program in `tools/`, blocked by a hook in
`.claude/hooks/`, or listed as a judgement call that a human must make.

Three kinds of statement appear, and they are marked:

| Marker | Meaning |
|---|---|
| **MUST** | Enforced by a gate. A build violating it cannot ship. |
| **SHOULD** | Enforced as a warning. Requires a written waiver to skip. |
| **CONSIDER** | Judgement. Not machine-checkable. A human decides. |

Evidence strength is marked too, because a manual that presents folklore and
replicated findings with equal confidence teaches an agent to trust the wrong
things:

| Marker | Meaning |
|---|---|
| `[STRONG]` | Replicated experimental or meta-analytic support |
| `[MODERATE]` | Real studies, limited scope or contested |
| `[CONVENTION]` | Craft practice with no empirical warrant — still often correct |
| `[FOLKLORE]` | Widely repeated, poorly supported. Do not cite. |

§14 lists every claim this manual **rejects**, with the reason. Read it. A
large fraction of what circulates as design law does not survive contact with
the literature, and repeating it costs credibility.

---

## 1. Prime directive

> **Build the most beautiful thing that is also the most usable thing.**
> When those conflict, usability wins — and then find a way to make the usable
> version beautiful. That is the job.

Three failures this manual exists to prevent:

1. **The generic build.** Competent, forgettable, indistinguishable from every
   other machine-generated app. This is the default outcome and takes active
   work to escape (§4).
2. **The pretty broken build.** Wins galleries, fails VoiceOver and TalkBack,
   fails contrast, janks on a real mid-range phone.
3. **The drift.** Rules followed for the first ten files and quietly abandoned
   by the fortieth. §2 addresses this structurally.

---

## 2. How this manual binds the agent

A design document that is merely *read* gets ignored around the point where
context fills up. This one is enforced by five mechanisms, each covering a
different failure mode.

| Layer | Mechanism | Prevents |
|---|---|---|
| 1 | `CLAUDE.md` — loaded at session start, re-injected after compaction | Never knowing the rules |
| 2 | `SessionStart` hook — injects live project status | Stale assumptions on resume |
| 3 | `UserPromptSubmit` hook — re-injects non-negotiables each turn | **Drift in long sessions** |
| 4 | `PreToolUse` hook — blocks violating writes before they land | Violations entering the codebase |
| 5 | `Stop` hook — exit 2 refuses to end the turn on a failing gate | "Done" on a broken build |

Layers 4 and 5 are the ones that matter. They are not advice — they are exit
codes. A `PreToolUse` hook exiting 2 blocks the tool call outright; a `Stop`
hook exiting 2 refuses to let the turn end and feeds the reason back.

**Path-scoped rules** in `.claude/rules/` load only when the agent touches a
matching path, so the full manual costs almost nothing in context until it is
relevant.

**Tampering.** Everything under `tools/` and `.claude/hooks/` requires human
approval to edit or delete (`permissions.ask` in `settings.json`), and the Stop
hook fails *closed* if the gate has gone missing. An agent that can silently
rewrite or remove its own gates has no gates. If a rule is genuinely wrong, it
gets changed by a human, in a commit, with a reason.

---

## 3. The build sequence

Steps are ordered. Skipping one is the most common cause of a generic result,
because each step constrains the next.

```
0  INTAKE      /design-intake     → DESIGN-CONTRACT.md
1  DIRECTION   /design-direction  → art direction chosen and justified
2  SCAFFOLD                       → Expo (React Native + TS) + NativeWind,
                                     then the foundation install
3  TOKENS      /design-tokens     → theme.ts + NativeWind config, contrast-verified
4  STRUCTURE                      → IA, routes (expo-router), tab-bar + stack nav
5  COMPONENTS                     → primitives, all states
6  SCREENS                        → real content, never lorem
7  REVIEW      /design-review     → independent audit
8  SHIP        /design-ship       → all gates green
```

**MUST** — no `.tsx` or `.jsx` screen or component may be written before step 0
produces `DESIGN-CONTRACT.md`. Enforced by `DS-025`. The `PreToolUse` hook
refuses the write.

Step 2 is the seam with the method layer: scaffold the Expo app *before* tokens,
then land the foundation into the structure the scaffold created (`app/`, and the
`metro` / `babel` / `tailwind` config). Full reasoning:
`BUILD STRUCTURE PLAN/01-BUILD-SEQUENCE.md`.

Why this order: tokens derive from direction, direction derives from audience
and category. Building components first means inventing values ad hoc and
retrofitting a system that was never a system.

---

## 4. Escaping the default

### 4.1 Why generated design converges

Generative systems regress toward the mean of their training data, and that
mean is the last decade of app and web UI. The result is the **maximally
prototypical** screen.

This matters because of a real finding: **prototypicality is one of the
strongest predictors of aesthetic rating** in the literature — effect sizes up
to η²p = .81, comparable to or exceeding visual complexity `[STRONG]`. Typical
things are rated as attractive, because they are easy to process, and
processing fluency is experienced as pleasantness.

So the default output genuinely does test as "fine". It is also completely
forgettable. **Prototypicality is a floor, not a ceiling.**

### 4.2 The strategy

> **Conventional structure. Distinctive surface.**

**Be prototypical where deviation costs comprehension:** a visible bottom tab
bar; back where back belongs and the OS back gesture honoured; familiar screen
order; native controls and platform-conventional gestures; familiar form
behaviour. Users spend most of their time in other apps, and arrive with those
expectations already formed `[MODERATE]`.

**Be distinctive where deviation costs nothing:** typography, colour, material,
composition, motion character. This is where memorability is bought, and it is
free in usability terms.

### 4.3 The one bold move

Every project gets **exactly one** place where it takes a real risk.

The reason is the isolation effect: an item is remembered when it differs from
its neighbours `[STRONG]`. But distinctiveness is **relational**, not absolute
— an element is not memorable because it is red, but because it is red where
everything else is not. A screen with five bold elements has none.

**MUST** — the bold move is named in `DESIGN-CONTRACT.md`, and what stays quiet
around it is named too.

### 4.4 The template test

**CONSIDER** — remove the logo and the brand colour. Is the screen
distinguishable from a template? If not, the direction was never actually
applied.

---

## 5. Colour

### 5.1 Author in OKLCH

**MUST** — every design token is authored in `oklch(L C H)`.

HSL's lightness axis is not perceptually uniform. `hsl(60 100% 50%)` and
`hsl(240 100% 50%)` are nominally equal in lightness and differ enormously in
perceived brightness. A ramp built by stepping HSL lightness produces uneven,
muddy mid-tones and unpredictable contrast ratios. OKLCH's `L` maps to
perceived lightness, so equal steps look equal and contrast behaves
predictably across hues.

**OKLCH is a generation-time space only.** React Native cannot evaluate
`oklch()` at runtime, so the generator does the perceptual work in OKLCH and
emits **resolved hex** to `theme.ts`. Never put an `oklch()`, `rgb()` or `hsl()`
literal in a `style={{}}`, a `StyleSheet`, or a NativeWind class — RN styles
carry hex, and the token layer already resolved it.

### 5.2 Ramp construction

**MUST** — ramps are generated, never hand-picked:

```bash
node tools/token-gen.mjs --out theme.ts
```

Two rules the generator implements, both of which hand-built ramps get wrong:

- **Chroma tapers at both ends.** Holding chroma constant pushes the lightest
  and darkest steps outside sRGB, where they get clipped. This is what makes
  generated palettes look chalky at the top and muddy at the bottom.
- **Neutrals carry the brand hue.** A pure `#808080` beside a saturated brand
  colour reads as unconsidered. A neutral at chroma ≈0.008 on the brand hue
  reads as chosen. **SHOULD** — never pure grey.

### 5.3 Contrast is a gate

**MUST** — WCAG 2.2, checked in **both** the light and the dark object:

| Pair | Minimum |
|---|---|
| Body text | 4.5:1 |
| Large text — ≥24dp, or ≥18.66dp bold | 3:1 |
| UI component boundaries, focus indicators, meaningful icons | 3:1 |

Two details that tools routinely get wrong:

- **Ratios are truncated, never rounded.** 4.499:1 fails 4.5:1. W3C is explicit.
- **14pt bold is 18.5–18.66dp**, not 18dp. W3C states "approximately 18.5px";
  14 × 1.333 = 18.66. Take the stricter figure. An 18dp bold heading is
  *normal* text and needs 4.5:1.

**APCA is advisory only.** It is **not** in the WCAG 3 draft — it was removed in
July 2023, and the March 2026 draft does not mention it. It has no legal
standing anywhere. The auditor computes it as a second opinion because it models
dark-mode and thin-type legibility better than WCAG 2's relative-luminance
ratio, but **never gate on it**.

### 5.4 What colour psychology actually supports

Be sceptical here. Most of what circulates is marketing folklore.

**Supported:**
- Colour meaning is **contextual**, not intrinsic. The same hue carries opposite
  meanings across contexts. The academically respectable theory of colour
  psychology is one that says universal colour–emotion mappings do not exist
  `[MODERATE]`.
- Brand-personality associations exist: red → excitement, blue → competence,
  with saturation and lightness carrying independent effects `[MODERATE]`.
- Warm and saturated colours are more arousing; **brightness and saturation
  explain far more variance than hue** `[MODERATE]`.
- Colour preference is ecological and varies enormously by culture and
  demographic — peak preferred colourfulness ranges 3.6–7.6 on a 9-point scale
  across subgroups `[MODERATE]`.

**Rejected:** "blue conveys trust" `[FOLKLORE]` — no primary source; the effect
is confounded with category prototypicality, since banks and social networks
already use blue. Also rejected: "colour increases brand recognition by 80%"
and "85% of shoppers cite colour as the primary reason they buy" — neither has
a traceable source.

### 5.5 Harmony schemes

Complementary, triadic and split-complementary derive from Bauhaus colour-wheel
pedagogy. They are `[CONVENTION]`, not findings — and they are geometric
constructions on a perceptually **non-uniform** wheel.

What research supports is narrower: preference for a colour pair is dominated by
preference for the individual colours, plus a **hue-similarity** effect. That
partially supports *analogous* schemes and does **not** support complementary
ones as inherently pleasing.

Use schemes as a generative starting point. Then verify in OKLCH, where equal
angular steps are actually equal perceptual steps.

### 5.6 The 60-30-10 rule

`[FOLKLORE]` — no author, no study, no origin. An interior-decorating rule of
unclear provenance.

The underlying idea is defensible on other grounds: one dominant neutral, one
supporting hue, one scarce accent gives clear figure-ground separation, keeps
the accent scarce (isolation effect), and keeps colour complexity low — and
low visual complexity is the single strongest predictor of aesthetic appeal
`[STRONG]`.

**Keep the practice. Drop the numbers and the false authority.**

### 5.7 Never colour alone

**MUST** — WCAG 1.4.1. Around 8% of men have a colour-vision deficiency. Every
state signalled by colour also carries an icon, a label, or a shape.

---

## 6. Typography

### 6.1 The settled question

Serif vs sans-serif makes **no reliable difference to screen legibility**. A
review of 72 studies found no valid conclusion favouring either `[STRONG null]`.

What actually predicts legibility `[STRONG]`:

1. **x-height relative to size** — dominates typeface category entirely
2. **Letter discriminability** — how distinct `I l 1`, `O 0`, `rn m` are
3. **Absolute size at viewing distance** — critical print size ≈0.2° of visual
   angle; below it reading degrades fast, above it speed plateaus
4. **Contrast**
5. **Line length and leading** — better supported than typeface choice

**Therefore: choose the display face for voice, not legibility.** Serif body
text on modern high-DPI screens is a defensible, differentiated choice. The old
"sans is more legible on screen" rule was a rasterisation artefact of 72–96dpi
displays and no longer applies.

Also rejected: "serifs guide the eye along the line" `[FOLKLORE]` — post-hoc
rationalisation. And "hard-to-read fonts improve learning" — failed a large
multi-site replication.

### 6.2 The scale

**MUST** — a single ratio, and nothing between its steps. One off-scale size is
enough to make a screen read as unresolved.

Default 1.25 (major third) from 16. Values are **sp/dp** (RN's
density-independent units), not CSS px or rem:

```
xs   12    lg   18    3xl  31    6xl  61
sm   14    xl   20    4xl  39    7xl  76
base 16    2xl  24    5xl  49
```

A note on honesty: the ratio holds strictly from `3xl` upward (31 = 16×1.25^3,
39, 49, 61, 76). The lower steps are the familiar 12/14/16/18/20/24 UI sizes,
which sit closer together because interface text needs finer gradation than
display text does. That is a deliberate compromise, not a pure geometric scale.

1.333 or 1.5 for high drama. Below 1.2 the hierarchy stops reading.

Type respects the OS text-size setting (Dynamic Type / `fontScale`), so leave
`allowFontScaling` on and never pin a layout to a fixed pixel height that a
larger font scale will overflow.

### 6.3 Hard numbers

**MUST**
- Body text ≥ **16**. Below this, text is uncomfortable to read under the thumb,
  and inputs in particular need it (a 16 body input reads cleanly on a phone).
- Line-height ≥ **1.5** for body — the WCAG 1.4.8 floor. Headings tighten to
  1.1–1.25 as they grow.
- Measure ≤ **75 characters**. WCAG 1.4.8 caps at 80.
- Never justify text (`textAlign: 'justify'`) — it creates rivers and breaks
  word-spacing.

**On the "45–75 characters" rule:** the figure originates with Bringhurst
(1992), writing about **print**, and hedged as "widely regarded" — an appeal to
convention, not data. Screen studies actively conflict: one controlled study
found 55 CPL best for comprehension; another found 95 CPL fastest with
comprehension flat. Treat ≤75 as a **convention plus an accessibility ceiling**,
not as a research-derived optimum. `[CONVENTION]`

**On line-height 1.5:** a standards-committee value, not an empirically derived
optimum. Treat it as a well-chosen floor. `[CONVENTION]`

### 6.4 Text must survive scaling

**MUST** — the device analogue of WCAG 1.4.12 (AA). Users enlarge text
system-wide through **iOS Dynamic Type** and **Android font scale**, and nothing
may break when they do:

- Leave `allowFontScaling` on (its default) — never disable it to protect a
  layout.
- Never pin a text container to a fixed height; let it grow.
- Test at the largest system font setting, including the accessibility sizes.

Fixed-height containers holding text are the usual failure.

### 6.5 Pairing

**SHOULD** — two families maximum, three with a mono. Contrast them on an axis
that reads: classification, weight, or width. Two similar sans faces read as a
mistake.

**MUST NOT** — Inter as the **display** face. Not a quality judgement: Inter is
an excellent UI face and is fine for body and interface text. It is banned for
display because it carries no voice. Same reasoning applies to Poppins,
Montserrat and Space Grotesk as defaults.

Fonts load through **`expo-font`** (bundled, held behind the splash until
ready) — never a web `next/font` import. Register the family names in the
NativeWind config so `display` / `body` resolve.

### 6.6 Typeface personality

Perception of typeface personality is consistent **by category** — serif reads
stable/formal, script reads youthful/casual, mono reads plain/conforming
`[MODERATE]`. Sans-serifs rate **neutral on every trait**, so you cannot claim a
particular grotesque "conveys confidence".

Note the limit: consistent personality attribution to a typeface **does not
reliably transfer** to perception of the text it sets. All of this is rating
data, not behaviour — no evidence of effects on conversion or comprehension.

---

## 7. Layout, space and hierarchy

### 7.1 Space is the system

**MUST** — 4dp base grid. Every spacing value divisible by 4. Enforced by
`DS-002`. Sizes are dp — density-independent pixels, the unit RN uses for every
layout number.

Rhythm is what makes unrelated components feel like one system. It is also the
cheapest thing to get right and the most obvious when wrong.

**SHOULD** — space belongs to layout, not elements. Use a single flex `gap` on
the parent, not a margin on every child. RN margins do not collapse the way CSS
margins do, but per-child margins still make spacing depend on sibling order and
scatter the value across the tree — the same maintenance problem. (`gap` is
supported on modern RN — **verify current**; on an older runtime fall back to a
spacer or a margin on all-but-first.)

### 7.2 Grouping — what actually works

Gestalt principles, with honest grading:

| Principle | Status | Use |
|---|---|---|
| **Common region** | `[STRONG]` — overrides proximity when they conflict | Cards, panels, bounded groups. This is *why* cards work. |
| **Proximity** | `[STRONG]` — the only one with a validated quantitative model | Spacing communicates relationship. Related things closer than unrelated. |
| **Similarity** | `[STRONG]` for colour/size, weaker for shape | Consistent treatment implies consistent meaning |
| **Continuity** | `[MODERATE]` | Alignment creates implied lines that guide the eye |
| **Figure/ground** | `[STRONG]` | Elevation, contrast, overlap establish depth |

The practical consequence: **space between groups must exceed space within
them**, by enough to read. A 4dp difference does not register; use at least one
full step of the scale.

### 7.3 Hierarchy

Ordered by strength `[STRONG]`: **position** → **size** → **contrast** →
**weight** → **colour** → **whitespace/isolation**.

**CONSIDER** — squint at the screen. The three most important things should
emerge in the intended order. If everything emphasised, nothing is.

**MUST** — one primary action per screen. Isolation is relational (§4.3).

### 7.4 Visual complexity

The strongest single finding in the aesthetics literature: **visual complexity
predicts appeal negatively and roughly linearly** `[STRONG]`. Together with
colourfulness it accounts for a large share of variance in first-impression
ratings.

**SHOULD** — when a layout is not working, remove before adding.

### 7.5 The first screenful

Attention concentrates at the top of a scroll and thins as it goes — the first
screenful gets the most attention, but it is no longer a hard barrier: people
scroll by default.

- **"Everything important on the first screen" is dead.** Cramming to obey it is
  counterproductive.
- But the concentration is real: the value proposition and primary entry points
  belong in the first screenful — meaning the first screen on the **smallest
  supported device**, not a generous one.
- **SHOULD** — avoid the *illusion of completeness*. A first screen that exactly
  fills the display and looks self-contained stops people scrolling. Let the
  next section peek above the bottom edge so it is obvious there is more.

### 7.6 Responsive to the device

There is no browser viewport. Adapt to the **device and its state**.

**MUST** — no horizontal overflow at the smallest supported width (~320dp) or
when system text is scaled up. Wide content — tables, code, wide charts — lives
inside its own horizontal `ScrollView`; the screen itself never scrolls
sideways.

- React Native lays out with **Flexbox and nothing else** — no CSS grid, no
  float, no `@container`, no media queries. `flexDirection` defaults to
  `column`, and children size to their parent by flex ratio or percent, not by
  viewport units.
- **SHOULD** — read size with `useWindowDimensions()` (re-renders on rotation
  and iPad split-view) rather than a one-time `Dimensions.get()`. The meaningful
  breakpoints are **phone → large phone → tablet**, plus **orientation**;
  reserve them for genuinely layout-level decisions (one column vs two, tab bar
  vs rail).
- Content sits inside the **safe area** (`react-native-safe-area-context` —
  `useSafeAreaInsets` / `SafeAreaView`); only full-bleed backgrounds extend
  under the notch, status bar and home indicator. Never hard-code a status-bar
  height.

---

## 8. Navigation and information architecture

This section carries the strongest evidence in the manual. Treat it as the
least negotiable.

### 8.1 Visible navigation

`[STRONG]` — NN/g, 179 participants, 6 sites:

| Metric | Hidden nav | Visible / combo |
|---|---|---|
| Navigation used, large screen | 27% | 48–50% |
| Navigation used, phone | 57% | 86% (persistent + overflow) |
| Content discoverability | **>20% worse** | baseline |
| Task time | **≥39% slower** | baseline |
| Perceived difficulty | +21% | baseline |

The finding transfers directly to apps.

**MUST** — primary destinations live in a **persistent, visible bottom tab bar**,
not behind a hamburger/drawer. A drawer as the *only* navigation reproduces the
hidden-nav penalty above and is blocked (`DS-020`).

**MUST** — the tab bar carries **3–5 co-equal destinations**. Beyond five
top-level areas, the fifth tab is a labelled **"More"** list, not a sixth tab —
this is the app equivalent of the combo pattern that won on phone.

Every tab carries an **icon and a label** — icon-only bars measurably hurt
recognition — and a clear selected state that is not colour alone. Placement and
contrast matter as much as visibility: a low-contrast trigger tested at 17%
usage against a 42% study average. Keep the bar above the home indicator
(safe-area inset); never let content hide behind it.

### 8.2 Breadth and depth

`[MODERATE]` — depth costs more than breadth. Each level multiplies decision
points and the cost of a wrong turn — and on a phone every extra level is another
full-screen push to unwind. Two-level structures beat three-level at equal node
count.

**SHOULD** — 2–3 levels; 3–5 tab-bar destinations; where a section needs
breadth, a grouped on-screen list (5–9 items, ≤10 per group) beats a wide flat
one.

But shape is second-order. **Label quality dominates.** The original study's own
conclusion was that category-name distinctiveness mattered most. A three-level
hierarchy with excellent information scent beats a two-level one with vague
labels. Front-load the information-carrying word; avoid invented brand
vocabulary — a tab label has almost no room to recover from a bad guess.

**MUST NOT** justify item counts with "Miller's 7±2" `[FOLKLORE as applied]`.
Miller measured recall of items held **without external support** and called the
number "a pernicious, Pythagorean coincidence". A visible tab bar or on-screen
list externalises the memory entirely. The working-memory limit was later
revised to ~4 anyway. Cap navigation width for scanning cost and reachable
targets — not for Miller.

### 8.3 Menu selection is not logarithmic

`[STRONG]` — for a menu or list a user has **never seen**, selection time is
**linear** in item count: `T ≈ 0.08n + 0.30` seconds. Only once the layout is
memorised does it become logarithmic (`0.08·log₂n + 0.24`).

So "Hick's Law means fewer items are faster" is directionally right for the
wrong reason, and gives the wrong magnitude — the penalty for adding items to an
unfamiliar list is **far worse** than log₂ suggests. Every additional visible
item costs a novice ~80ms of search.

### 8.4 Every screen is an entry point

Deep links, universal / app links, push notifications, widgets and share sheets
all drop the user **mid-hierarchy** with no run-up.

**MUST** — every screen orients on its own: a clear **title** in the header; the
current tab marked with **real** visual prominence (not a 5% opacity shift); a
visible, reliable **back** affordance; section-level visual differentiation so a
screen feels like it belongs somewhere; and, when a user arrives cold via a link
into a leaf, an explicit **up** path into the app so they do not dead-end.

**CONSIDER** — the test worth adopting verbatim: open a screen cold, as a deep
link would, and ask *"where am I in this app, and how do I get out?"* Designer
familiarity systematically hides how weak these signals are.

### 8.5 Menus and disclosure

The web mega-menu has no place here — and **there is no hover on touch**, so
hover-timing and diagonal-travel mechanics do not apply. When a section has many
items, the mobile patterns are a **sectioned/grouped list**, an expandable row,
or a further **stack push** — recognition over recall still wins, but on one
screen at a time.

**SHOULD** — chunk long lists into labelled groups; order by workflow or
frequency; no duplicates across groups. A **bottom sheet** is the app equivalent
of a disclosure panel for a focused set of choices or a filter tray.

**MUST NOT** — deeply nested inline accordions. A push to a new screen is
usually clearer than a third level of expand-in-place, and interactive widgets
buried in a disclosure panel are hard to reach.

### 8.6 Collapsing headers

**SHOULD** — a collapsing / hiding-on-scroll native header reclaims scarce
vertical space on long screens. Reasonable, but not a default.

- Cap the header at a modest share of screen height; the native large-title and
  app-bar shapes are the expected ones.
- Auto-hide on scroll-down is fine, but it **must not** hide a control the user
  needs.
- **MUST** — WCAG 2.4.11: a focused element is never *entirely* hidden behind
  the header (or behind the software keyboard). Ensure it scrolls into view.

**MUST NOT** cite "sticky menus are 22% faster" `[FOLKLORE]` — one ~40-person
unpublished 2012 test, never replicated.

### 8.7 Reach and grip

**MUST** — the bottom-anchored primary tab bar caps at **5 items**; beyond that
touch targets cannot stay adequate.

Grip is highly variable: one-handed 49%, cradled 36%, two-handed 15%. No single
grip reaches half of use, so design for grip-independence. A bottom bar is
reachable across more grips than a top bar; the most frequent action can also
surface as a reachable primary control rather than a top-corner one.

**MUST NOT** use the coloured "thumb zone" heatmap `[RETRACTED]`. Its author
disavowed it in 2017: *"people touch the center of the screen. More, more
quickly, more accurately, and by preference. Not the corners or edges."*

The Fitts's-Law corner argument is **desktop-mouse-only** — it depends on
pointer clamping at screen edges, which does not exist on touch.

### 8.8 Search and filters

**SHOULD** — search is an expectation, not a bonus. Success rates rose from 64%
(2000) to 92% (2017) as ranking and placement standardised.

**MUST NOT** cite "half of users are search-dominant" `[FOLKLORE]` — a
late-1990s figure. Modern behaviour is hybrid: search to enter a category, then
browse and filter within it.

**MUST** for faceted navigation: the **filter tray / bottom sheet with an
explicit "Apply"** (it outperformed inline-expand and a separate screen in
testing); applied filters visible and individually removable (chips above the
results); result counts shown; category-specific facets over generic ones.

---

## 9. Components and states

### 9.1 States are not optional

**MUST** — every interactive element ships: rest, press/active, focus, disabled.
Plus loading where async, and error where input is possible.

| State | Requirement |
|---|---|
| Rest | Default token colours |
| Press / active | A perceptible change on `onPressIn` — a lightness step, not a colour swap. Use `Pressable`'s pressed state |
| Focus | Visible focus ring for keyboard / switch / D-pad users, ≥3:1 against both the control and the screen. Touch is not the only input |
| Disabled | Reduced opacity **and** `accessibilityState={{ disabled: true }}`. Never colour alone |
| Loading | Where async: a spinner or skeleton, plus `accessibilityState={{ busy: true }}` |
| Error | Where input is possible: token colour **and** an icon **and** text |

A component without its states is not finished. This is the most common gap
between "looks right in a screenshot" and "feels right in use". Hover exists only
for pointer input (an external mouse/trackpad on iPad) and must never be the
*sole* affordance — there is no hover on touch.

### 9.2 Focus

**MUST** — never remove the accessibility focus indicator (WCAG 2.4.7, AA). On a
touch screen there is no persistent focus; focus obligations apply when the app
is driven by something **other** than a finger — a hardware keyboard (iPad,
Android tablets), Switch Control / Switch Access, a TV D-pad, or a screen
reader's navigation cursor. Drive a focused style from the control's focus
callbacks, and make it a real lightness/border change, not a subtle tint:

```tsx
<Pressable
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
  style={[styles.item, focused && styles.itemFocused]}  // ≥3:1 ring/border
/>
```

Three separate obligations, commonly conflated:
- **2.4.7 (AA)** — a visible focus indicator exists. No size or contrast numbers.
- **1.4.11 (AA)** — 3:1 against adjacent colours. *This* is where the "focus
  ring must be 3:1" figure legitimately comes from.
- **2.4.13 (AAA)** — ≥2px perimeter-equivalent area, and 3:1 **between focused
  and unfocused states** — a change-of-state contrast, not background contrast.

**MUST** — WCAG 2.4.11: the focused element is never *entirely* hidden behind a
collapsing header, a bottom bar, or the software keyboard.

### 9.3 Targets

**MUST** — **44pt (iOS) / 48dp (Android)** for any interactive control.
The WCAG 2.5.8 (AA) floor is 24×24dp — a deliberately achievable **legal floor**,
noticeably worse than either platform's guidance. Apple recommends 44pt and
Material 48dp; meet those, not just 24.

Exceptions in 2.5.8: inline targets in a run of text; OS-controlled sizing; an
equivalent control elsewhere; an essential presentation (map pins); and the
**spacing exception** — an undersized target passes if a 24dp-diameter circle
centred on it does not intersect another target's circle.

Where the visible element is smaller than the target (an icon button, a small
glyph), expand the touch area with **`hitSlop`** rather than shrinking the
target. Never make the `Pressable` the size of the glyph. Adjacent targets need
~8dp of clear space minimum.

### 9.4 Use the primitives

**SHOULD** — never hand-roll a dialog, select, action sheet, bottom sheet or
tooltip. Focus handling, the OS back-gesture, `accessibility*` wiring and gesture
conflicts are the hard parts, and hand-built versions get them wrong. Reach for
React Native's own `Modal` / `Pressable` / `FlatList` and a maintained
sheet/menu library **(verify current)** first.

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

### 9.5 Feedback timing

Response-time thresholds `[MODERATE]`, from Miller (1968) and RAIL:

| Budget | Meaning |
|---|---|
| **100ms** | Feels instantaneous. Acknowledge every input within this. |
| **1s** | Flow preserved. No spinner needed below this. |
| **10s** | Attention lost. Show progress and allow cancellation. |

**MUST NOT** cite the "Doherty Threshold, 400ms" `[WEAK]` — a 1982 unreviewed
internal IBM report on mainframe terminals, promoted to a "law" by blogs. Use
Miller's 0.1/1/10s or RAIL instead.

---

## 10. Motion

### 10.1 Motion must mean something

**SHOULD** — animation exists to explain a state change: where something came
from, what it belongs to, that something happened. Decorative motion with no
communicative function is the most common tell of a design that is performing
rather than working — motion that implies sophistication the product does not
have.

### 10.2 Reduced motion

**MUST** — honour the OS **Reduce Motion** setting (iOS: Accessibility → Motion;
Android: Remove animations). There is no global stylesheet on device — read the
flag **in code**, per animation, so it is verified **on-device**, not by a
stylesheet the gate can grep (`DS-016`).

```tsx
import { useReducedMotion } from "react-native-reanimated";
// or: AccessibilityInfo.isReduceMotionEnabled()
//     + AccessibilityInfo.addEventListener("reduceMotionChanged", …)

const reduce = useReducedMotion();
const entering = reduce ? FadeIn : SlideInRight;   // movement → cross-fade
```

Read the flag at the animation site and subscribe to changes — a value cached at
launch goes stale when the user toggles the setting. A near-instant transition is
safer than `0` for anything that resolves on an animation-complete callback:
never strand a callback waiting on an animation that never runs.

`reduce` does **not** mean "remove all animation" — it means remove, reduce, or
**replace** motion. The correct substitution is movement → cross-fade, not
movement → nothing. Kill: parallax, background video, large translation,
zoom/scale transitions, spinning, auto-advancing carousels, programmatic
smooth-scroll jumps. Keep: opacity transitions, meaningful state feedback,
loading indicators.

Note the standards asymmetry: automatically-starting motion is Level **A**
(2.2.2), but scroll- and gesture-triggered animation is Level **AAA** (2.3.3) —
i.e. not legally required. Given the severity of vestibular reactions, treat
2.3.3 as required anyway.

### 10.3 Hard limits

**MUST** — WCAG 2.3.1 (A): nothing flashes more than three times per second.

**MUST** — WCAG 2.2.2 (A): moving content that starts automatically, lasts more
than 5 seconds, and sits alongside other content needs pause/stop/hide.
Auto-rotating carousels are the canonical failure — and the 5-second exception
does **not** apply to auto-updating content (feeds, tickers).

**MUST** — WCAG 1.4.2 (A): any audio playing automatically for more than 3
seconds needs a pause/stop or independent volume control. Muting the OS does not
satisfy it.

### 10.4 Craft

**SHOULD**
- One easing set, one duration set, project-wide (§ tokens)
- Enter faster than exit — arriving is informative, leaving is not
- Animate `transform` and `opacity` only. These run on the **UI/native thread**
  (Reanimated worklets, or `useNativeDriver: true`); layout props — width,
  height, margin, flex, `top`/`left` — cannot use the native driver, run on the
  JS thread, and drop frames under load
- 100–160ms micro-interactions, 240ms transitions, 400ms+ only for large moves;
  over ~500ms feels broken unless it carries genuine distance
- Never animate an element the user is about to tap — a button that moves under
  the thumb is a Fitts's Law violation with attitude
- Stagger sparingly: 30–50ms between siblings, only for lists under ~8 items

### 10.5 What to reach for

Keep animation on the UI thread. Reach for the declarative layer first; drop to
manual worklets only where it genuinely cannot express the motion.

| Need | Tool | Notes |
|---|---|---|
| Enter/exit of conditional content, list add/remove | Reanimated layout animations (`FadeIn`/`SlideIn…`, `entering`/`exiting`, `Layout`) | Runs on the UI thread; honours Reduce Motion on supported platforms (verify current) |
| Screen / route transitions | The navigator's own transitions (Stack `animation` options in expo-router) | Carries the back-gesture and platform direction for free |
| Spring, drag, gesture-driven motion | Reanimated worklets + `react-native-gesture-handler` | Gesture on the UI thread avoids JS-thread jank |
| Simple one-off layout change | Core `LayoutAnimation` | Limited and less predictable than Reanimated (verify current) |

Prefer **react-native-reanimated** for anything non-trivial: its worklets run on
the UI thread, so motion survives a busy JS thread. Let the **navigator** own
screen transitions and the interactive back-swipe (iOS edge swipe, Android
predictive back) — a custom transition that swallows it breaks a reflex users
rely on. Shared-element transitions are still evolving (verify current); treat
them as an enhancement and make sure the screen is complete without the effect.

---

## 11. Accessibility

WCAG 2.2 Level AA is the floor, not the goal. Note that the legally cited
baseline in the US DOJ Title II rule and the currently-cited EN 301 549 v3.2.1 is
still **2.1 AA**; 2.2 is a superset, so building to it satisfies both.

Native accessibility has **no axe** — no automated crawler that catches even a
third of the failures. **Turn on the screen reader and use the app**: VoiceOver
(iOS) and TalkBack (Android) is the single most valuable check and nothing
substitutes for it. An automated pass is even less sufficient here than on the
web — **say plainly whether the screen-reader walkthrough was actually done.**

### 11.1 Structure

**MUST** — a clear title per screen; section titles marked with
`accessibilityRole="header"` (no skipped levels) so the reader's heading rotor
can jump between them — the native equivalent of a skip link; a reading/grouping
order that matches visual order; the app locale set and text localisable; related
content grouped with `accessible={true}` on the wrapper so it is announced as one
unit.

Reading order follows the view hierarchy — a layout that positions children out
of source order (absolute positioning, reversed flex) desyncs them, which is a
failure. An element removed from the tree or marked
`importantForAccessibility="no-hide-descendants"` is invisible to assistive
tech: never hide something a non-touch user needs to reach.

### 11.2 New in WCAG 2.2

The six A/AA additions worth knowing:

| SC | Level | Requirement |
|---|---|---|
| 2.4.11 Focus Not Obscured | AA | Focused element not *entirely* hidden (usually by the software keyboard) |
| 2.5.7 Dragging Movements | AA | Any drag action has a single-pointer alternative |
| 2.5.8 Target Size | AA | 24×24dp floor, with exceptions — design to 44pt / 48dp |
| 3.2.6 Consistent Help | A | Help mechanisms appear in consistent relative order |
| 3.3.7 Redundant Entry | A | Previously entered info auto-filled or selectable |
| 3.3.8 Accessible Authentication | AA | No cognitive function test in any auth step |

2.5.7 in practice: a slider needs stepper buttons or a numeric input;
drag-to-reorder needs move-up/move-down controls — gesture-only actions strand
switch and screen-reader users.

3.3.8 in practice: never block paste in password or OTP fields, support password
managers, no puzzle CAPTCHAs without an alternative, never require transcribing a
code between devices as the only route.

### 11.3 Screen-reader and assistive navigation

Two distinct concerns get conflated:

| Concern | Requires |
|---|---|
| **Screen-reader focus** (VoiceOver / TalkBack) | Correct reading order and a meaningful `accessibilityLabel` / `accessibilityRole` on every element the cursor lands on. This is the obligation that matters for almost every app. |
| **Hardware-focus indicator** (keyboard / switch / D-pad) | A **visible** highlight on the currently focused control — 3:1 against its surroundings (§9.2). |

**MUST** — every interactive element is reachable and operable with VoiceOver /
TalkBack, and carries a role and a meaningful label; focus order matches visual
order. A **modal** must trap the assistive cursor: set `accessibilityViewIsModal`
(iOS) and mark the content behind it `importantForAccessibility="no-hide-descendants"`
/ `accessibilityElementsHidden`; move focus to the modal on open
(`AccessibilityInfo.setAccessibilityFocus`) and return it to the trigger on
close.

A modal trap is **not** a WCAG 2.1.2 violation — the OS back gesture / a close
control is a standard exit. Reserve serious hardware-focus effort for apps that
genuinely run on TV, tablet-with-keyboard or switch input; for a phone-only touch
app, screen-reader focus is the obligation that counts.

### 11.4 Fit and reflow

**MUST** — WCAG 1.4.10: content fits the smallest supported width (~320dp) with
no horizontal scrolling of the screen, and respects the safe-area insets so
nothing clips under the notch, status bar or home indicator. Combined with §6.4:
the layout must also survive the largest Dynamic Type / font-scale setting
without clipping.

---

## 12. Performance

Performance is a design constraint, not an engineering afterthought. A beautiful
screen that janks when you scroll it, or an app that shows four seconds of splash
before anything is usable, is a badly designed app — the delay is part of the
experience.

There is no single cross-platform p75 regime like the web's Core Web Vitals.
Native performance is a handful of concrete numbers, measured per platform:

| Metric | Target |
|---|---|
| **Cold start** — launch to first interactive screen | Keep it short; every extra second loses people at the door |
| **Frame rate** — sustained 60fps (**16.7ms/frame**; 120fps ≈ **8.3ms** on ProMotion) | Never drop frames during scroll or animation |
| **Input latency** — response within 100ms | Acknowledge every tap immediately (§9.5) |
| **Scroll performance** | No blank cells, no stutter in long lists |

**Two threads decide most of this.** RN runs your logic on the **JS thread** and
draws on the **UI (native) thread**. Anything heavy on the JS thread — a big
re-render, JSON parsing, an un-virtualized list — starves it, and animation or
gestures driven from JS stutter. Keep animation on the UI thread; move heavy work
off the render path.

**MUST**
- **Virtualize every long list.** `FlatList` / `SectionList`, or **FlashList**
  for large or heavy lists — never `.map()` inside a `ScrollView`, which renders
  and holds every row. Stable `keyExtractor`, and a known item size
  (`getItemLayout` / `estimatedItemSize`) where you can.
- **Cache and size every image.** Use **`expo-image`** (memory + disk cache,
  `placeholder`/blurhash, `contentFit`, `priority`, `recyclingKey` for list
  cells). Serve assets at the size they render, not the size they were shot.
  `expo-image`'s `priority` is a **legitimate, supported prop** — it is *not* the
  retired web `next/image` priority rule; `DS-009` is N/A in RN.
- **Avoid needless re-renders.** `React.memo` on list rows, stable callbacks
  (`useCallback`), memoised values, narrow state selectors.
- **Keep animation on the UI thread.** Reanimated worklets or `useNativeDriver:
  true`; animate `transform`/`opacity`, never layout props (§10.4).
- **Reserve space for anything that loads late** — skeletons or fixed-size
  placeholders, so the layout does not jump when data or images arrive (the app
  equivalent of CLS).
- **Ship with Hermes** — it precompiles to bytecode, cutting startup and memory
  versus JSC. Default in current Expo/RN (verify current); do not disable without
  a measured reason.

**Cold start** is design-critical — the first thing every user experiences, every
time. Do the minimum before the first screen; defer non-critical init
(analytics, feature flags, prefetch); lazy-load heavy screens and libraries
(expo-router lazy screens, `React.lazy`). Hold the splash
(`expo-splash-screen`) only to first meaningful paint — a blocking splash or a
full-screen spinner as the default first experience is a banned pattern.

Fonts self-hosted via **`expo-font`**, held behind the splash until ready — never
a web `next/font` import.

**Over-the-air updates** (expo-updates / EAS Update): the download is your JS
bundle plus changed assets, so keep it small. Big static media belongs in the
binary, not re-downloaded on every update; watch bundle growth (a heavy
dependency for one screen inflates both cold start and every OTA). Large native
changes need a new store build anyway (verify current policy).

Lab numbers are a proxy. The metric that counts is a real, mid-range device on a
real network.

---

## 13. Content

**MUST** — no lorem ipsum in a committed file. Placeholder text hides the
failures only real content reveals: the heading that wraps to three lines, the
40-character name, the empty category.

**MUST** — no invented statistics, fabricated testimonials, or logo walls for
non-clients. If proof does not exist yet, design the screen without it.

**SHOULD** — design for the **real** content counts recorded in the contract. A
layout built for twelve case studies collapses with two.

**MUST** — every collection has a written empty state that says what belongs
there, why it is worth having, and what to do next.

See `.claude/rules/copy.md` for voice and microcopy rules.

---

## 14. The folklore ledger

Claims that circulate as design law and do **not** survive scrutiny. Do not cite
these. If a stakeholder cites one, the honest answer is what the evidence
actually shows.

| Claim | Verdict |
|---|---|
| "Users read in an F-pattern, design to it" | **Inverts the source's conclusion.** F-scanning is a *symptom* of unformatted text — NN/g calls it bad for users and businesses. The fix is formatting, not accommodation. |
| "7±2 items in navigation (Miller's Law)" | Misreading. Miller measured memory span for **non-visible** items and called the number "a pernicious, Pythagorean coincidence". Later revised to ~4 anyway. |
| "Hick's Law: more items = log-slower" | Wrong domain. Novice menu search is **linear** (0.08n + 0.30s). Hick applies only to memorised layouts. |
| "Zeigarnik effect motivates completion" | **Failed.** 2025 meta-analysis, 38 studies, interrupted-to-completed recall ratio **0.99**. The surviving effect is *Ovsiankina* — 67% task resumption. Keep the pattern, rewrite the rationale. |
| "Beautiful designs are perceived as more usable" | Correlational, same-session, no actual interaction. The relationship reverses after real use. |
| "Users decide in 50ms whether to stay" | Overstated. The study measured **visual appeal ratings of screenshots** — not behaviour, not credibility, not retention. |
| "Blue conveys trust" | No primary source. The real finding is blue → *competence* in brand-personality ratings, confounded with category prototypicality. |
| "60-30-10 colour rule" | No traceable source at all. Decorator convention. The underlying logic is sound; the numbers are invented. |
| "Complementary colour harmony is pleasing" | Bauhaus pedagogy, not research. Preference tracks **hue similarity**, which if anything favours analogous. |
| "Sans-serif is more legible on screen" | **Null result across 72+ studies.** x-height and letter discriminability are what matter. |
| "Serifs guide the eye along the line" | Post-hoc rationalisation. No support. |
| "Hard-to-read fonts improve learning" | Failed a large multi-site replication. |
| "Sticky menus are 22% faster" | n≈40, unpublished, 2012, never replicated. |
| "Inline validation: 22% fewer errors" | n=22, unpublished, 2009. Direction corroborated qualitatively; the numbers are not citable. |
| "The thumb-zone heatmap" | **Retracted by its own author** in 2017. |
| "Put targets in screen corners (Fitts)" | Desktop-mouse only. Contradicted on touch by centre-preference findings. |
| "Doherty Threshold = 400ms" | 1982 unreviewed internal IBM report. Use Miller (1968) 0.1/1/10s. |
| "Choice overload / the jam study" | Meta-analysis of 50 studies found a mean effect of ~**zero**. |
| "~50% of users are search-dominant" | Late-1990s figure. Modern behaviour is hybrid. |
| "Colour increases brand recognition by 80%" | No traceable source. |
| "APCA is the WCAG 3 contrast method" | **Removed from WCAG 3 drafts in July 2023.** The WCAG 3 algorithm is undetermined. Not usable for compliance. |

### The claims that do hold up

If this manual needs a spine, these five are the best-supported things in it:

1. **Low visual complexity** is the strongest single predictor of aesthetic
   appeal — negative and roughly linear.
2. **Prototypicality** is comparably powerful (η²p up to .81) and operates via
   processing fluency. It is a floor, not a ceiling.
3. **Hidden navigation** degrades every measured UX metric — >20% discoverability
   loss, ≥39% task-time penalty.
4. **Serif vs sans does not affect legibility.** x-height, letter
   discriminability, size and contrast do.
5. **Field count, not step count**, drives form abandonment.

---

## 15. Gates

Nothing ships until these pass. Run `node tools/gate.mjs`.

| Gate | Checks |
|---|---|
| **G1** Contract | `DESIGN-CONTRACT.md` exists, complete, no unfilled placeholders |
| **G2** Lint | Static rules `DS-001`…`DS-025` (see `tools/rules.json`) |
| **G3** Tokens | Every semantic pair meets WCAG 2.2 AA in **both** the light and dark object |
| **G4** Types | `tsc --noEmit` clean |
| **G5** Runtime | Overflow, tap targets, focus visibility, heading order, screen-reader labels, safe-area, reduced motion — on a real device |

The **runtime gate is a real-device check, not a browser one.** A React Native
app is verified on a device / simulator, and an automated device audit needs a
harness (Detox / Maestro — **verify current**). A **skipped** gate is not a pass:
run the core flow on a real iOS and Android device, and if you cannot, say so
plainly rather than implying the build is verified.

**MUST NOT** — modify or delete anything under `tools/` or `.claude/hooks/` to
make a gate pass. Those paths require human approval for exactly this reason,
and removing the gate is treated as a failure, not a pass.

---

## 16. Judgement

Everything above is enforceable. This is not, and it is the part that separates
a build that passes from a build that is good.

- **Does the app have a point of view?** A screen that could belong to any
  company in its category has failed, whatever its scores.
- **Does the hierarchy match what actually matters** to this business, or just
  to whoever wrote the copy?
- **Would you use this?** Not "does it meet spec" — would you, on your own
  phone, on a bad connection, in a hurry?
- **What did you leave out?** Restraint is the hardest thing to demonstrate and
  the most reliable signal of confidence.

When a rule and the work genuinely conflict, say so, name the rule, and propose
something that serves what the user actually wants. Silent non-compliance is the
one failure this manual has no mechanism to catch.

---

*Every empirical claim here was verified against primary sources. Where sources
conflict, both are stated. Where a common claim is unsupported, it is listed in
§14 rather than repeated.*
