# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json    → exit 0
$ npm run visual -- salesCoachSettings → 2 passed, 4 images
$ npm run visual -- training           → 3 passed, 6 images
$ npm run check                        → 715 files, 5522 passed, 15 skipped, CHECK_EXIT=0
```

## It was looked at

**`settings-account.light`, before** — a tab strip (Account underlined in ember, Coaching beside
it), then **Name / Jordan Ellis, Elostate role / Member, Sales Coach role / Admin as three bare
rows with no container**. Below them bordered cards for Learning Mode, Experience Mode and Voice
enrollment, and a "Start voice check" ember button. The Learning Mode toggle shows a dark knob on
a light track at the card's top right.

**`settings-account.dark`** — the same three rows as **three clearly bordered pills**. That pair is
the finding.

**`settings-account.light`, after** — three bordered white pills, matching the dark structure.

**`settings-coaching.light`** — Monthly quota with a "20" input and a pale Save; Daily sales goal
with a "Choose a rep…" select; Coaching methodology with a green check reading "Reviews currently
use your team's own corpus", "Last saved 9/18/2026, 10:20:00 PM by Jordan Ellis", an "Upload a
file" button and a monospace editor showing the methodology, "227 / 100,000 characters"; Product &
brand details the same shape; Cue voice with a "Follow C.A.R.E voice" radio and a Preview button.
The Save buttons are pale because nothing has been edited — the legitimate disabled state.

**`settings-coaching.dark`** — the same, on black.

**`training-rep.light`, before** — "Your trainings" and "Your practice" as **two unbounded
stretches of text**; WORK ON / MOVES TO ADD with Learn and Practice buttons; a practice list
reading 78 improving, 61 holding, 44 slipping.

**`training-rep.dark`** — the same content as **two clearly bordered cards**.

**`training-rep.light`, after** — two bordered white cards; the trend words in darker green, grey
and amber.

**`training-manager.light`, before** — "Team training brief" with Day/Week and a Build button, and
**no container**, above a bordered "Team practice" card (12 practices, 2 reps practising, 64 avg
score, 1 improving, 1 slipping) and two bordered per-rep cards for Jordan Ellis and Sam Ortiz.
**Day and Week look identical** — no selection is visible.

**`training-manager.light`, after** — the brief sits in a bordered card and **"Week" carries a grey
highlight**, so the selected period can be read.

**`training-manager.dark`** — brief bordered and Week highlighted, before and after.

**`training-error.light` / `.dark`** — the honest error branch, reached by a 500 rather than a 403.

## Findings

### A defect in a component the page mounts but does not contain

class: white-alpha container, in a child component, with an alpha one step off the swept string
sweep: `grep -rn "Team training brief" src` → `TeamTrainingBriefPanel.tsx`, a file no per-route sweep had touched
severity: medium

**[OBSERVED]** `border-white/[0.07] bg-white/[0.03]`. Every fix this session replaced the exact
string `border border-white/[0.07] bg-white/[0.02]` — the deck kit's. `[0.03]` makes that replace a
silent no-op.

**[OBSERVED]** `bg-white/10` marked the SELECTED period segment, so on cream Day and Week were
indistinguishable.

**Two independent reasons it survived**: the file is not the route's file, and the value is not the
swept string. Either alone would have hidden it.

### Nine containers and three account rows on `/settings`

class: the session's standing class
sweep: `grep -nE "white/" settings/page.tsx` → 9, now 0
severity: medium

**[OBSERVED]** `Row` at :221 is itself a card; the three account rows had no container on cream.

### Six containers on `/training`

**[OBSERVED]** "Your trainings" and "Your practice" lose their cards on cream.

### The Learning Mode knob, seen at last

**[OBSERVED]** It renders. Two builds ago it was `bg-secondary` — a utility that did not exist — and
was fixed at the Tailwind config. Until this capture that was a claim about a pattern; it is now a
claim about a picture, and it closes R3 of that build.

## Two harness gaps, each checked before being worked around

**[OBSERVED]** `/settings` rendered as one empty `<div>`. `useTheme` and `useToast` throw by design
outside their providers, and a throw during render unmounts the tree.

**[OBSERVED]** `layout.tsx:144` mounts `ThemeProvider` and `:8` imports `ToastProvider` around the
whole app, so production is unaffected.

Recorded because "the page renders nothing" is indistinguishable from a real crash, and the check
that told them apart was two greps.

## What this does not prove

**Four routes remain unrendered**: `/[id]`, `/kpi`, `/team`, `/team-chat`, `/door`.

**The `bg-white/[0.03]` lesson is not swept.** I fixed the instance I rendered. How many other
child components carry a white-alpha container with an alpha my exact-string replaces missed is
**unknown** — the number is in the residual as unknown rather than estimated.
