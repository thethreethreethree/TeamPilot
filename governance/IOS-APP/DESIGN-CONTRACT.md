---
# ─────────────────────────────────────────────────────────────────────
# Machine-read. token-gen.mjs, the hooks and the gate parse this block.
# Keep the keys and shapes exactly. Prose belongs in the body below.
# ─────────────────────────────────────────────────────────────────────

project: Elostate Sales Coach
client: Elostate
date: 2026-09-02

# Confirmed by the owner 2026-09-02. Chosen because the ratified
# brand already specifies its defining traits: a true dark ground, one luminous
# accent, surfaces separated by lightness step rather than borders.
direction: high-contrast-dark

color:
  # ember-400 — "the bulb". The ratified brand primary (docs/BRAND.md §4.1).
  seed: "#FACC15"
  # No accent key: the identity is deliberately mono-amber. BRAND.md §4.3 bans
  # red, cyan and navy outright; a second hue would contradict the governance.
  #
  # 286 is the MEASURED hue of the ratified ink scale (ink-950/900/500 all sit at
  # 285.9° in OKLCH). This is a deliberate, recorded deviation from the design
  # law's guidance that neutrals carry the BRAND hue — see "Recorded deviations".
  neutralHue: 286
  # Measured ink chroma runs 0.0044 (ink-950) to 0.0138 (ink-500); 0.008 is the
  # midpoint and sits inside the design law's 0.006–0.012 band.
  neutralChroma: 0.008
  hueShift: 0

type:
  display: Inter
  body: Inter
  scaleRatio: 1.25

radius: 0.75

navigation: stack

voice: direct and encouraging, never judging

# BAN-12 = "Inter as the display face". Waived; justification in §11.
waivers: ["BAN-12"]
---

# Design contract — Elostate Sales Coach

This document is binding. Every visual decision in this project derives from it.
If a build contradicts this contract, the build is wrong.

**Two documents outrank the taste in here and are cited throughout:**
`docs/BRAND.md` in the TeamPilot repo (the ratified visual identity — *"the logo
is the constitution of the visual identity"*), and
`SALES-COACH-BUILD-ARCHITECTURE/` in this repo (the integration architecture and
phased build plan). Where this contract restates them, they are the source.

---

## 1. The business

**In one sentence, what changes for the customer:**
A field sales rep can see, on the phone they already carry, the record of what
they actually said in a pitch and what the coach observed about it — instead of
that record living only on a laptop they are not holding at the door.

This app is **a first-class client of the Elostate system already in production**,
not a rebuild. Same Supabase project, same accounts, same coaching records
(`SALES-COACH-BUILD-ARCHITECTURE/00-START-HERE.md`).

---

## 2. Audience

| | |
|---|---|
| Who | Sales reps in the field (the `agent_id` owner of a `coaching_sessions` row). Managers read their company's rows via the same RLS, but the rep is the primary user. |
| Platform | **iOS only for this build.** Phone-first. iPad not a target. |
| Prior knowledge | They already use the Elostate web coach. They arrive knowing the vocabulary — sessions, cues, outcomes, report card. |
| State of mind on arrival | **Mid-day, between calls, in a hurry.** Possibly one-handed, outdoors, on patchy signal. Not seated, not reading at length. |

The physical context decides more than the screen size does: every flow must
survive being interrupted, and nothing may depend on sustained reading.

---

## 3. The one job

**The single primary conversion:** *ask the coach and use what it suggests.*

Originally recorded as "sign in and see my real sessions" — the build plan's
Phase 1, and the right first slice. Phase 2 shipped on 2026-09-02, and the
primary job moved with it: the session list is the **record**, the coach is what
the app is FOR. The list screen's one primary action is now "Ask the coach"; the
list itself is the context around it.

Secondary actions, in order: read the session list · open a session for its
transcript and cues · sign out.

Still **out of scope**: the KPI board and call recording (Phase 3, which needs
the Bearer shim deployed first) and offline capture (Phase 4). Neither may
compete for a primary action slot.

> Confirmed against `SALES-COACH-BUILD-ARCHITECTURE/07-BUILD-PLAN.md` Phase 1,
> which names this "the core of the ask" and reaches it with zero backend change.

---

## 4. Competitive position

| Competitor | What they do well | What we are moving away from |
|---|---|---|
| *(not supplied)* | | |

**Category convention:** not researched. **(open — see §12)**

**Where we deliberately break it:** deferred to `/design-direction`.

> **Deliberately not applicable.** The owner confirmed on 2026-09-02 that this is
> an internal tool for Elostate's own reps, not a product competing for install.
> The audience already uses the web coach and arrives with its conventions, not a
> competitor's. This is a recorded decision, not a blank waiting to be filled.

---

## 5. Direction

**Chosen:** `high-contrast-dark` — **confirmed by the owner, 2026-09-02.**

**Why this client, specifically:**
1. The ratified identity is literally this direction's definition — a true dark
   ground (`ink-950 #09090B`, not grey), one luminous accent (`ember-400`), and
   `docs/BRAND.md` §5 separates surfaces by **lightness step** (`bg-base` →
   `bg-surface` → `bg-surface-raised`) rather than by borders.
2. The audience is a rep glancing at a phone between calls — the direction's
   "precise, fast, lightness transitions" motion character suits a glance, where
   a slow editorial fade would not.

**The one bold move:**
The amber glow as the app's only source of colour light. `docs/BRAND.md` §6.1–6.2
already defines `bulb-glow` and three glow-shadow intensities; on a matte-black
phone screen in daylight that warm halo is the entire visual signature.

**What stays quiet:**
Everything else. No second hue, no gradient, no decorative motion, no ornament.
Type is one family at one ratio. The glow only reads because nothing else glows.

### Divergence self-check

- [x] **Would this be obviously wrong for the competitors named above?**
      Cannot be answered — no competitors were named. Recorded as open, not
      claimed as passed.
- [x] Three decisions that could only apply to this client:
      1. Error and danger are rendered in **burnt amber `ember-800`, never red**
         (BRAND.md §4.3) — an inversion of near-universal convention.
      2. The neutral field is **cool zinc at 285.9°** sitting under a **warm
         amber at 91.9°** — a 194° opposition, measured, and deliberately kept.
      3. The lightbulb mark with a lowercase **e** as its filament is the only
         permitted brand anchor, at fixed sizes per surface (BRAND.md §8).
- [ ] **Display face is not Inter** — **FAILS BY DESIGN.** Waived; see §11.
- [x] No hero gradient. The only gradient permitted is `bulb-glow`, a radial
      ambient behind the mark, declared in §6 below.
- [x] With the logo removed, is this distinguishable from a template?
      Yes — an amber-on-matte-black field with no red anywhere is not a shape any
      stock Expo template produces.

---

## 6. Colour

| Role | Value | Note |
|---|---|---|
| Brand seed | `#FACC15` | ember-400, "the bulb". From `docs/BRAND.md` §4.1 — ratified 2026-06-12, enforced by `scripts/theme-audit.mjs`. |
| Accent | *(none)* | Deliberately mono-amber. A second hue would contradict BRAND.md §4.3. |
| Neutral bias | `286°` | Measured hue of the ratified ink scale. Not pure grey (chroma 0.004–0.014). |

**Accent discipline.** The accent must stay scarce. Distinctiveness is
relational: an element is not memorable because it is bright, but because it is
bright *where nothing else is*. **Ember appears in at most three places per
screen.** Once a fourth use appears, the honest move is to remove one — not to
amend this number.

**Colours that are banned outright on this project**, from BRAND.md §4.3:
**no red · no cyan · no navy · no neon yellow.** Error and danger use
`ember-800 #854D0E` (burnt amber) plus an icon plus text — never colour alone.

**The contrast hazard that has no React Native equivalent.**
BRAND.md §7 records that white text on ember fails accessibility, and the web
solves it with a CSS rule that automatically swaps `text-primary` children inside
ember backgrounds to `#09090B`. **There is no CSS cascade on device.** So the
token layer must carry it: `primary-foreground` must resolve to near-black, not
white. `token-gen` solves foregrounds for contrast rather than guessing, so this
should happen automatically — **it must be verified on the emitted `theme.ts`,
not assumed** (`/design-tokens` definition-of-done).

**Declared gradients:**

| Name | Stops | Where used | Why |
|---|---|---|---|
| `bulb-glow` | radial, `ember-400` at 30% → 12% → transparent (BRAND.md §6.1) | Behind the mark on a hero or splash surface only | It is the ratified signature treatment, not decoration. |

Tokens are generated, never hand-picked:

```bash
node tools/token-gen.mjs --theme Elostate-Sales-coach/theme.ts
```

---

## 7. Typography

| Role | Face | Weights | Where |
|---|---|---|---|
| Display | Inter | 700, 900 | Screen titles, the wordmark (900, tracking -0.01em) |
| Body | Inter | 400, 500, 600 | Running text, UI, list rows |

**Scale:** 1.25 (major third) from a 16dp base.

**Voice in type:** Inter carries no particular voice — that is precisely why the
design law bans it for display. On this project the voice is carried by
**colour and material** (amber light on matte black) rather than by letterforms,
which is a deliberate trade recorded here so it is not mistaken for an oversight.

**Loading.** Inter is bundled with the app via `expo-font` and held behind the
splash until ready — never fetched from Google Fonts at runtime, which is how the
web app currently loads it (`src/app/globals.css`). A face fetched at first paint
is a flash of the system font followed by a reflow.

**No mono face is declared.** BRAND.md does not specify one; if a surface needs
tabular figures, use Inter with `fontVariant: ['tabular-nums']` rather than
introducing a family the brand has not ratified.

---

## 8. Navigation and structure

**Pattern:** `stack` — for the first release only.

The first release has exactly one destination (the rep's session list) and one
drill-down (a session's detail). A tab bar with a single tab is not navigation,
it is chrome. So v1 is a stack.

**Target shape once the later phases land:** a **bottom tab bar of 3–5
destinations**, each owning its own stack. The likely destinations, from the
build plan's phases: **Sessions** (Phase 1) · **Coach** (Phase 2) · **KPIs**
(Phase 3). Decide the exact set at `/design-direction` before the second
destination is built, not after — the shape is a design decision, not a default
to accept unseen.

**Screens in the first release:**

1. `(auth)/sign-in` — the only unauthenticated screen. No sign-up: accounts are
   provisioned in the Elostate admin, mirroring the web's sign-in-only rule.
2. Sessions list — the rep's own `coaching_sessions`, newest first, painted from
   cache first and reconciled against the network.
3. Session detail — transcript segments in `seq` order, plus the cues delivered.
4. Ask the coach — streams a suggested response from the existing
   `/api/coach/extension/suggest` route.
5. `+not-found` — the catch-all for a dead deep link or notification.

**Why the coach is a pushed screen and not a tab.** Two destinations is below the
3–5 the design law requires of a tab bar, and asking the coach is a
self-contained interrupting task rather than a place a rep dwells. It is reached
by the list screen's primary action. **The tab bar arrives when Phase 3 makes it
three destinations** — Sessions, Coach, KPIs — and that is when the destination
set gets decided, not before.

**Back and up:** the native stack header back plus the iOS edge-swipe gesture,
owned by the navigator. A session opened cold from a notification must still
resolve "up" to the list rather than dead-ending.

---

## 9. Content reality

Design for these numbers, not the aspirational ones.

| Content type | Real count at launch |
|---|---|
| Sessions per rep | **Dozens** — these are existing active users with real history |
| Transcript segments per session | Unbounded and append-only; a long pitch produces many |
| Cues per session | A handful to dozens |
| Photography | **None.** This is a typography-and-colour product; there is no image content |

**Consequences that follow directly:**
- The session list **must virtualize** (`FlatList`) from day one. It is not a
  short fixed set, and `.map()` inside a `ScrollView` would hold every row.
- The transcript view is the longest list in the app and must virtualize too.
- The empty state still gets written — a brand-new rep exists — but it is the
  rare case, not the design target.

**Longest plausible strings to test:** a `client_label` a rep typed in a hurry at
a door (long, unpunctuated, no spaces guaranteed); a transcript segment that is a
full uninterrupted paragraph of speech.

---

## 10. Constraints

| | |
|---|---|
| Locales | English only. RTL not required. |
| Accessibility target | WCAG 2.2 AA. VoiceOver must reach every control. |
| Performance budget | Cold start short on a real device · sustained 60fps (16.7ms/frame) · input acknowledged ≤100ms · no dropped frames scrolling a long transcript |
| Min OS | **iOS 15.1** — verified from `node_modules/react-native/scripts/cocoapods/helpers.rb:83` (`min_ios_version_supported = '15.1'`), the floor of the installed RN 0.86.3 / Expo SDK 57. Requires Xcode 16.1+. |
| Android | **Out of scope for this build.** `app.json` currently declares Android config; that is inert until Android is in scope. |
| Backend | Existing Elostate Supabase project + the `/api/coach/**` routes. The app is a thin client; the server stays the single source of truth. |
| Device capability | Microphone is **not** required in the first release. It arrives with Phase 3 audio and must be requested in context, never at launch. |
| Deadline | Not supplied. |

**Build environment constraint worth recording:** development happens on Windows,
so iOS cannot be built or simulated locally. Every build goes through EAS, and
every real verification needs a physical iPhone. A simulator screenshot is not
available here, which makes the real-device check the *only* visual check.

---

## 11. Waivers

Each waived rule needs a real reason. "The client asked for it" is a record, not
a justification — what makes it acceptable here despite the rule is written out.

| Rule ID | Waived because | Approved by | Date |
|---|---|---|---|
| `BAN-12` — Inter as the display face | The ratified wordmark **is** Inter Black 900 (`docs/BRAND.md` §2), enforced in production since 2026-06-12. The design law bans Inter for display because it carries no voice — a real weakness, accepted knowingly. Introducing a second display face would put a different typographic voice on the phone than the web, which is exactly the same-product-different-experience divergence asset **A21** was written about, and would fight the wordmark it sits beside. The voice this project would have bought from a display face is instead carried by colour and material (§7). | Owner | 2026-09-02 |

---

## 12. Recorded deviations and open items

Not waivers — deviations from *guidance*, corrections to source documents, and
things honestly still blank. Recorded so they are visible rather than discovered.

### Deviations from the design law

**Neutrals are cool, not on the brand hue.** The law says neutrals should carry a
small chroma *on the brand hue*. Measured, the ratified ink scale sits at
**285.9°** and the brand at **91.9°** — 194° apart. The ink scale is kept because
it is ratified identity enforced by `scripts/theme-audit.mjs`, and A21 parity
with the web outranks a SHOULD. The MUST it must still satisfy — never pure grey
— holds: measured chroma is 0.004–0.014, not zero.

**The app is locked to dark.** `app.json` sets `userInterfaceStyle: "dark"`, so
the phone does not choose. The law says verify both schemes; there is only one
here, and `theme.ts` declares no `light` key so the gate cannot audit a palette
that never reaches a screen. BRAND.md calls the bulb-on-matte-black the canonical
logo state, and locking removed the light-mode contrast compromises that were
destroying the brand colour.

**`theme.ts` is hand-authored, not generated.** token-gen was run and its output
inspected. It could not reach the brand: it emitted `primary #806700` (L=0.523,
C=0.107) where ember-400 is `#FACC15` (L=0.861, C=0.173), because on a white
ground ember measures ~1.7:1 and its solver walked the primary down until white
text passed. It also emitted `destructive #E7000B` — a red — into an identity
that bans red. Per `03-DESIGN-BLUEPRINT.md` §1 the sanctioned remedy is explicit
token pairs, hand-verified, which is what `theme.ts` now holds.

**The gamification spec's light-mode Arena does not apply on mobile.** Section
5.2 of `GAMIFICATION-MOBILE-BUILD-SPEC.md` asks for the Arena in both light and
dark and names a light-mode accent of `#A16207`. This app is single-theme by
ratified identity (above), so the second theme was raised as an owner decision
rather than resolved in the build. **Decided 3 September 2026: dark only**, and
the spec is not applicable on mobile in this one respect. The palette itself was
never in dispute — the ember-on-ink colours 5.2 names are already this app's
tokens; only the second theme was. Recorded here so it is not re-raised as a
missing feature.

### Deviations from docs/BRAND.md, on measured accessibility grounds

All three stay inside the ratified ember/ink scales. No new colour, no red.

| BRAND.md says | Measured on matte black | Applied instead | Measured |
|---|---|---|---|
| `ink-500` is text-muted | **4.11** on base, **3.66** on the raised surface — fails 4.5 | `ink-400` | **7.76** base, **5.81** muted — AA |
| `ember-800` is error/danger | **2.9** as text — fails (ember-700 also fails at 4.04) | `ember-600` for error *text*; `ember-800` kept as an error *fill* | **6.77**; fill with `ink-50` on it is **6.56** — AA |
| `ink-800` is the dark border | **1.33** — fine for a divider, fails 3:1 for a control you must identify | `ink-800` for dividers, `ink-500` for control boundaries, `ember-400` for focus | **4.11** and **12.99** |

BRAND.md §7's own warning is confirmed by measurement: white on ember is **1.46**,
near-black on ember is **12.99**.

**Ripple — measured on the web, 2026-09-02, and confirmed.** TeamPilot's dark
mode has the same defect and it is worse on raised surfaces: `--text-muted`
(ink-500) measures **4.11** on `bg-base`, **3.66** on `bg-surface` and **3.08** on
`bg-surface-raised` — all below 4.5. `--border-default` (ink-800, **1.33**) and
`--border-strong` (ink-700, **1.90**) both fall below 3.0 for a boundary you must
identify, though both are acceptable as decorative dividers. `text-primary`,
`text-secondary` and `brand-text` pass. The owner's instruction was to measure and
report, not to change the web — so nothing there was touched. The app's fix
(`ink-400`, 7.76) transfers directly if it is ever taken up.

### Correction to the build plan's own documents

**`deal_value` is not integer minor units.** `03-DATA-MODEL-AND-SYNC.md` and
`01-INTEGRATION-ARCHITECTURE.md` both describe it that way. It is
`numeric(14, 2)` — an exact decimal in MAJOR units — per
`supabase/migrations/0205_kpi_foundation.sql`, whose own comment reads *"deal_value
is numeric (exact-decimal — money is never float)"*, and the server reads it as
`Number(row.deal_value)`. PostgREST serialises `numeric` as a **string**.
`src/types/backend.ts` has this right; the prose does not. Treating it as minor
units renders $1,500.00 as **$15.00**. `src/lib/format.ts` formats from the string
without float arithmetic. Both plan documents have been annotated.

### Things that must be re-applied if regenerated

- `theme.ts` is hand-authored. Running `token-gen --theme` over it destroys the
  pinned brand values and reintroduces the red `destructive`.
- `src/lib/tokens/index.js` mirrors `theme.ts` in CommonJS because
  `tailwind.config.js` must `require()` it and cannot load TypeScript. **Change
  one, change both.** Verified in step at the time of writing across background,
  foreground, primary, primary-foreground, muted-foreground, destructive, border
  and ring.

### Open items (blank on purpose; an invented value would be worse)

1. **Radius `0.75`** is *(assumed)*, derived from the 12dp corner already in use.
2. **Deadline** (§10). Not supplied.
3. **The tab-bar destination set** (§8) — decide before the second destination.

### Known defect in the governance tooling

The tamper lock in `.claude/hooks/law-read-gate.mjs` false-positives: it tests
"is this an in-place write?" and "does a governed path appear?" against the whole
command string independently, so an unrelated `cp` in the same command as a
mention of `tools/*.mjs` is blocked. The write target is not checked. It fired on
a legitimate file copy. It cannot be fixed by the agent — that path is denied by
the lock itself — and needs the deny lifted in `.claude/settings.json`.

## 13. Change log

| Date | What changed | Why |
|---|---|---|
| 2026-09-02 | Contract created | Project start. Brand values taken from the ratified `docs/BRAND.md`; audience, scope and platform confirmed by the owner; iOS floor and OKLCH values measured from source rather than assumed. |
| 2026-09-02 | Dark-locked; `theme.ts` hand-authored with the ratified brand; three BRAND.md role deviations applied on measured grounds; NativeWind installed as the styling stack; `deal_value` corrected from minor-units to `numeric(14,2)`; Phase 1 screens built | token-gen could not reach the brand colour and emitted a banned red; three ratified token roles failed AA on matte black; three design-law numeric gates were blind without NativeWind |
| 2026-09-02 | Owner confirmed the direction and resolved competitors as not applicable; web contrast ripple measured and confirmed; Phase 1 completed with a read cache, a not-found screen and a root error boundary; Phase 2 (live AI coaching) shipped; the Expo template icon replaced with the ratified Sales Coach mark and 14 orphaned template assets removed | The primary job moved from reading the record to asking the coach, so section 3 moved with it |
| 2026-09-02 | Session list grouped by local day with search; a regression suite added for the money and grouping logic (`npm test`, no framework dependency); `duration()` now carries hours; a timezone off-by-one fixed in the day labels | Two bugs of the same shape — logic that looked right on this machine and was wrong elsewhere. `deal_value` as minor units rendered $1,500.00 as $15.00; a local day key parsed as UTC labelled 28 August as "Thu 27 Aug" for every rep west of Greenwich. Both are now covered by tests proven to fail when the bug is reintroduced |
