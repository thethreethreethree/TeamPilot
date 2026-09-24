# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json     → exit 0
$ npm run visual -- sessionsList        → 4 passed, 8 images
$ npm run visual -- salesCoachAnalytics → 3 passed, 6 images
$ npm run check                         → 5511 passed, CHECK_EXIT=0
```

## It was looked at

**`sessions-rep.light`** — before: two bordered insight cards, three bordered stat cards reading
1 / 2 / 60, then a filter bar in which the search field and "All contexts", "All status", "All time"
are solid mid-grey slabs with grey-on-grey placeholder text. Three session rows below with outcome
pills, action buttons and an amber "One-sided" badge. After: the four controls are white fields
with light borders.

**`sessions-rep.dark`** — the same four controls as subtly inset dark fields with thin outlines.
The pair is the finding.

**`sessions-manager.light`** — before: a bordered card, "Your team", three rep rows with activity
lines ("41 sessions · 38 with audio · last active Sep 24"), and **no dividers between them**.
After: dividers present.

**`sessions-manager.dark`** — the same rows WITH dividers, before and after.

**`sessions-empty.light`** — the filter bar correct, and "No sessions yet. Start one from Home."

**`sessions-empty.dark`** — the same, on black.

**`sessions-expert.light`** — before: "Start a coaching session", the voice-enrollment notice, an
Online video / In-person pair, **a blank gap**, a mid-grey "Client / campaign (required)" slab, and
a washed-out Start button. After: the gap contains a sentence and the field is a white input.

**`sessions-expert.dark`** — the gap contains the mic notice, which is how I knew the light one was
missing something rather than simply spaced oddly.

**`analytics-expert.light`** — before: a green arc ending in a glowing dot, floating, with no track
and no tick. After: a grey track completes the semicircle and the standard tick is visible where
the fill meets it. "1740 ↗ +12 · Your Sales ELO Rating · 18 scored calls".

**`analytics-expert.dark`** — track dark grey, tick visible, unchanged by the fix.

## Findings

### "Ugly, not broken" was wrong

class: `bg-black/30 border-white/10 text-primary` on a theme-following ground
sweep: 11 sites this morning; 4 now fixed (2 in sessions, 2 in StartSessionPanel), 7 remain
severity: medium, and **higher than I told the founder**

**[OBSERVED]** On cream these render as solid mid-grey, reading as disabled controls. One of them
is the required field of the form that starts a coaching session, sitting above a button that is
genuinely disabled until it is filled.

**[OBSERVED]** I characterised this class to the founder as "ugly, not broken" and they declined a
sweep of it on that basis. The characterisation was made from the hex, not from a render.

### The honesty notice is invisible on cream

class: `text-white/N` used for BODY TEXT on a theme-following surface
sweep: `grep -rhoE "text-white/(\[[0-9.]+\]|[0-9]+)" src --include=*.tsx` → 75 uses in 5 files
severity: high

**[OBSERVED]** Present in the capture's DOM, absent from the light image, legible in the dark one.

**[OBSERVED]** Its own comment says it exists to satisfy §3.4 honesty — to stop a rep expecting the
coach to hear the prospect on a video call.

**[INFERRED]** Most of the other 73 uses are in `CareShell` and `SalesCoachShell`, which are
`bg-brand-shell` — fixed-dark in both themes — where `text-white/90` is CORRECT. **The severity of
this class is set by the ground, and the two files that mattered were the two that are not shells.**
The care-module mobile files (`CareRadialHome`, `RcdMobileSheet`, 46 uses) are unexamined.

### A gauge with no track and no standard

class: `text-white/N` driving `currentColor` on an SVG stroke
sweep: `EloMeter.tsx` — 2 sites
severity: medium

**[OBSERVED]** On cream the ELO gauge rendered as a floating green arc; the track and the 1500 tick
were absent.

This is the **fourth spelling** of the same class today, after `bg`/`border`, `stroke-`, and a
positioned `<span>` used as a hairline. None of the first three sweeps would find this one.

## PHANTOM avoided — ninth of the session

The empty-state capture shows three stat cards reading 1 / 2 / 60 above "No sessions yet." Two
endpoints, one emptied by my fixture — and the page has the distinction I was about to look for:
`sessions/page.tsx:689-690` picks between "No sessions yet. Start one from Home." and "No sessions
match these filters." Read the producer; do not report the render.

## What this does not prove

**Nine routes remain unrendered**: `/settings`, `/[id]`, `/kpi`, `/training`, `/team`,
`/scoreboard`, `/calibration`, `/team-chat`, `/door`.

**46 `text-white/N` uses in the care module's mobile files** have not been examined, and the class
that produced today's highest-severity finding is exactly that one.

**`RepActivity`** — the rep-detail view inside the manager roster — was not captured; the roster
was never clicked into.
