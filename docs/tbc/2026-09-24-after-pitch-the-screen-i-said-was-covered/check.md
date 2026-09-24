# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npm run visual -- afterPitch
      Tests  3 passed (3)
  6 image(s) in artifacts/visual/
exit 0
```

## It was looked at

**`after-pitch.light` (Standard, populated)** — before: the "Your scores" outer container had no
edge on cream, so seven bordered score tiles floated on the page ground with "Score Assessment
Review" and its explanatory sentence hanging below them; "What the coach cued" and "How did it go?"
had the same problem. After: three bordered white cards.

**`after-pitch.dark`** — the same content with all three containers bordered, before and after.
The pair is what shows the defect; neither image alone does.

**`after-pitch` header crop, light** — before: "HIDE" and its chevron in near-invisible pale yellow
on the pale amber "Your read" card. After: strong bronze, matching the bulb beside the title.

**`after-pitch-expert` timeline crop, light** — before: one glowing ember dot, alone. After: four
dots on a grey track, the breakdown node glowing, timestamps in near-black, labels below, the
breakdown's label in strong bronze, sentiment arrows in darker teal and amber.

**`after-pitch-expert` timeline crop, dark** — unchanged: white track, grey nodes, ember breakdown.

**`after-pitch-expert` mid crop, light** — "Your read" COLLAPSED here (it is open in Standard), its
label reading "TAP TO OPEN" in the same strong bronze; "What the coach cued" bordered; "Start Next
Door"; "Replay conversation". Expert has no Next Door Focus card and no outcome row — those are
Standard-only by design (page.tsx:49-53).

**`after-pitch-thin` light and dark** — the state most accounts are in. Honest heading ("No
conversation was captured for this call yet."), an explanation that distinguishes opening a session
from recording one, an upload card, a Rebuild button, the outcome row and Start Next Door. Bordered
in both themes after the fix. **No dead end** — §1.5.1 layer 3 satisfied without any change from
me.

## Findings

### Seven container cards borderless on cream

class: white-at-low-opacity as a border or fill on a theme-following surface
sweep: `grep -c "border border-white/\[0.07\] bg-white/\[0.02\]"` → 7, now 0
severity: medium

**[OBSERVED]** Three visible sections lose their containers in the light capture and have them in
the dark one.

### The conversation timeline is one dot on cream

class: same, as a positioned track and as node fills
sweep: the remaining three `white/N` in the file, all inside `Timeline` at :1075-1086
severity: high

**[OBSERVED]** Before the fix, the light Expert capture's timeline shows the ember breakdown node
and nothing else — no track, no other moments.

**[OBSERVED]** The dark capture of the same DOM shows four nodes on a visible track.

High because of which screen it is. This page is what One Liners points reps at for "the full
timeline and score", and the timeline was the part that disappeared.

### The palest step in the scale on a pale card

class: a raw tint chosen for a dark ground, used on a light-ground element
sweep: `grep -n "text-ember-200"` → the prominent CollapseToggle, label + chevron
severity: medium

**[OBSERVED]** Legible in dark, near-invisible in light, in both toggle states.

### Thirteen raw text tints

class: as above
sweep: `grep -nE "text-(emerald|amber|rose)-(200|300|400)" | grep -v dark:` → 13, now 0
severity: medium

**[OBSERVED]** The worst of them is the breakdown moment's label — the most important word on the
timeline, and the least readable element on it.

### NOT A DEFECT, but the founder should know: Standard has no timeline

class: a promise made on one surface about another surface's other branch
severity: medium — a copy/expectation mismatch, not a rendering fault

**[OBSERVED]** `isStandard` at `:715` splits this page into two screens. The timeline, the
breakdown moment and its correct line are EXPERT-only.

**[OBSERVED]** `strategy/page.tsx` tells every rep, in Standard as well as Expert: *"Your real
calls get the full timeline and score in the After Pitch Summary."*

**[INFERRED]** A Standard rep following that sentence finds scores, a read, a cue loop and a focus
— all good, and no timeline. Whether that is a copy problem or a missing-feature problem is the
founder's call, not mine.

## What this does not prove

**Nine routes remain unrendered** — `/settings`, `/sessions`, `/[id]`, `/kpi`, `/training`,
`/team`, `/scoreboard`, `/calibration`, `/team-chat`, `/door` — carrying 38 white-alpha sites in
their own page files.

**Every populated state here came from a fixture I wrote.** Whether a real after-pitch payload has
four moments with sentiments and a correction is not established by a capture.
