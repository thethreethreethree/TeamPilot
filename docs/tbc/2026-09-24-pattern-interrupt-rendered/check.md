# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npx eslint src/test/captures/patternInterrupt.capture.tsx
(no output)
exit 0
```

```
$ npm run visual -- patternInterrupt
      Tests  2 passed (2)
  4 image(s) in artifacts/visual/
exit 0
```

## It was looked at

**`pattern-interrupt-empty.dark.png`** — an amber cycle icon and "Pattern Interrupt" over
"Repeated misses from the recordings, with the clips to prove it". An amber-bordered explainer:
*"Patterns, not one-off mistakes. A pattern appears when the same miss shows up in 3 or more of a
rep's last 10 pitches. Your manager sees this same page. Use the clips to hear it for yourself,
then practice the fix in Role Play."* Four bordered counters — ACTIVE PATTERNS 0 "Yours right now",
NEW THIS WEEK 0 "Not coached yet", IMPROVING 0 "Trending the right way", FIXED 0 "5 clean pitches
in a row". Then a panel: **"Nothing has been scored yet"** over *"Patterns come from scored
pitches. Once your recordings are scored against the rubric, repeated misses show up here."*

**`pattern-interrupt.dark.png`** — the same header; ACTIVE PATTERNS now 1. A solid amber pill
"Jordan Ellis 1", then "JORDAN ELLIS'S PATTERNS". Left, an amber-outlined card: breadcrumb
"INTRODUCTION · TRUCKS / NEIGHBORHOOD NOTICE", a "Coaching" badge, "Trucks in the area", a ten-dot
red/green strip, "6 of 10 · −3.2 pts/pitch" with the figure in red, over a legend (red Missed,
green Done right, amber Partial). Right, a detail panel: "Missed in 6 of 10 pitches · open 10 days
· costing about 3.2 pts per pitch", a quoted verdict "Coached 6 days ago; no clean streak yet.",
**PATH TO FIXED** ("Done right in 5 pitches in a row. Clears automatically." · "0 of 5 clean
pitches in a row"), **FROM THE TAPE** with an "Open your recordings" button and *"Every miss on
this pattern is a marker on the recording it came from — click it to hear the moment."*, and
**COACHING NOTES** showing "You · Sep 18 / Lead with the trucks line before they reach for the
door."

Both light captures were produced and are consistent with their dark counterparts.

## Findings

### I advised against a screen I had never opened

class: a judgement about a SURFACE derived from a true fact about its DATA
sweep: the demo brief's own NOT-VERIFIED list — every entry there is a claim of the same kind, and this is the first one tested by looking
severity: medium

**[OBSERVED]** `docs/DEMO-READINESS-2026-09-24.md` section 3 said "This is the surface I would be least
willing to demo live", resting on two verified facts — detection only runs inside the scoring
route, no pattern has ever opened — that support a conclusion about data, not about a screen.

**[OBSERVED]** the empty state is a designed, honest artefact that renders §3.4's no-instant-results
argument better than prose.

**[INFERRED]** the other entries in that NOT-VERIFIED list are the same shape. Six Sales Coach
surfaces remain unrendered and the brief makes claims about none of them beyond "not rendered",
which is the correct form.

## What this does not prove

**The fixture is mine.** It proves the surface renders a well-formed pattern. Real detection output
— rubric labels, strip contents, edge cases — has never existed, so nothing here tests it.

**Five Sales Coach surfaces remain unrendered:** the report card, Roleplay, One Liners, Sessions,
Analytics and Settings.
