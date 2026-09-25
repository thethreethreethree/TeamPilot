# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- liveCoaching    → 2 passed, 4 images
$ npm run check                     → see closure
```

## It was looked at

**`live-coaching.light`, as found** — no card boundary; "Live coaching" wrapped onto two lines
beside the radio icon; the status row reading `LIVE · OBJECTION (LAST` / `READ) · SLOW + STEADY ·` /
`signal`, split mid-parenthetical; a bordered "Stop"; a control row of Mode / Suggestion / Guide my
response / I'm speaking / Auto-coach ON / Coach me now, each label wrapping to three lines; a green→
amber MIC LEVEL bar reading "picking you up"; a cream cue card carrying "Give a reason for the
question — the crew already pulled fiber to this block." with an "I used this" button; a bordered
transcript card with Salesperson/Prospect turns and the partial in italic.

**`live-coaching.light`, after `whitespace-nowrap`** — chips atomic, and **`signal` clipped at the
card's right edge**. Worse than what it replaced.

**`live-coaching.light`, after `flex-wrap`** — "Live coaching" on one line; `LIVE · OBJECTION
(LAST READ)` on one line and `· SLOW + STEADY · signal` on the next; the card's border visible;
nothing clipped.

**`live-coaching.dark`** — the same layout with the card a shade above the page, the chips in
ember and grey, the mic bar green→amber on black.

**`live-coaching-not-recording.light`** — "Live coaching ERROR" beside an ember "Start live
coaching"; an amber-bordered banner reading **"Recording stopped — nothing is being captured."**
over "The mic was released by another app."; the Mode pair; an unchecked earpiece checkbox in a
bordered box; and the error sentence again below in red.

**`live-coaching-not-recording.dark`** — the same on black.

## Findings

### The live-call panel had no card on cream

class: white-alpha container on a theme-following surface
sweep: render-tree → `LiveCoachingPanel.tsx` 2 sites, now 0
severity: high — this is the only screen whose defects cost a live conversation

**[OBSERVED]** `:214`'s `<section>` is the panel's own card. Invisible on cream, present on dark.

**[OBSERVED]** These two sites were identified in the sweep an hour before and NOT fixed when I
fixed `/[id]`'s tree — I patched the page file and `PivotAndScores` and left the component whose
route I had just declared done.

### Status chips: a wrap, then an overflow

class: atomic text units in a row that cannot wrap
sweep: the header row, three spans
severity: medium

**[OBSERVED]** Before: `(LAST` / `READ)`. After nowrap alone: `signal` clipped. After
`flex-wrap` + `min-w-0`: correct.

**[OBSERVED]** The intermediate state LOST CONTENT, where the original only looked wrong.

### A capture that photographed the wrong screen and passed

class: a wait condition satisfied by text present in every state
sweep: not a sweep — the eighth instance of this shape today
severity: high, as method

**[OBSERVED]** `audioCapturing: false` with `status: "live"` cannot render the banner, which is
gated on `!live`.

**[OBSERVED]** `/audio|mic|recording/i` matched "MIC LEVEL".

**[OBSERVED]** The file's own docstring, written minutes earlier, warns about imagined mocks and
about this session having paid for them twice.

## Observation, not a finding

The not-recording state prints the error sentence **twice** — once as the banner body, once inline
below. Redundant on a small panel. A content judgement rather than a defect, and not mine to make
unilaterally.

## What this does not prove

**The control row still wraps every label to three lines** at the real 448px width — Mode,
Suggestion, Guide my response, I'm speaking, Auto-coach ON, Coach me now. Nothing is clipped and
every label is readable, so it is density rather than breakage. **Not changed**: re-laying out the
live control row is a design decision and belongs to the founder, not to a colour pass.

**The `captureStalled` warning was not rendered.** It is gated on a timer plus an empty transcript,
and no fixture here produces it. It is the panel's loudest moment — "the mic stopped — audio isn't
recording" — and it remains unseen.

**`SessionRecordingUpload` is mocked to null here**, so its 3 sites are still unrendered.
