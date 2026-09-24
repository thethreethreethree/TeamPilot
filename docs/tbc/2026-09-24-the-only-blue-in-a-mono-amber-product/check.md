# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- calibration     → 2 passed, 4 images
$ npm run check                     → 714 files, 5513 passed, 15 skipped, CHECK_EXIT=0
```

## It was looked at

**`calibration.light`** — "Score calibration", the explainer ("Score each transcript yourself, then
compare to the AI. This checks the score is trustworthy before it drives the leaderboard"), a
bordered notice reading "Some dimensions disagree · across 3 scored", a bordered transcript card in
monospace, then "Your scores (0–10)" with five labelled rows. **Before: five BRIGHT BLUE sliders.**
The "Submit & compare" button below them is a solid ember bar with near-black text.

**`calibration.dark`** — the same, on black, with the same blue sliders before the fix.

**`calibration.light`, after** — the five sliders are ember: an amber filled track to the thumb, a
round amber thumb, a dark unfilled remainder. They now match the button directly beneath them.

**`calibration.dark`, after** — the same amber fill with a grey unfilled track.

**`calibration-report.light`** — the trust report: five dimensions with their ±diff, three in green
(0.7, 1.1, 0.9) and two in amber with a ⚠ (2.4, 1.8), the explanation line ("±diff is how far the
AI is from you on average (0–10 scale). Above 1.5 (⚠) means that dimension needs another look"),
and a bordered card reading "No more transcripts to score right now. The report above reflects what
you've scored." No defects.

**`calibration-report.dark`** — the same values in green and amber against the card, all legible.

## Findings

### Native controls in the browser's default blue

class: a native control that consumes `accent-color`, with no accent set, in a mono-amber product
sweep: every `<input>` of type range/checkbox/radio in `src/**/*.tsx`, scanned to the tag end at brace-depth 0 → **5 offenders**, after excluding two for cause
severity: medium

**[OBSERVED]** Five sliders render bright blue in both themes on the Calibration screen.

**[OBSERVED]** `accent-ember-400` is the established convention, used at ten other call sites.

**[OBSERVED]** `docs/BRAND.md` is cited in `after-pitch/page.tsx:63-66` as "our mono-amber
identity, NOT the PDF's blue/red … ('no red')".

Medium rather than high: nothing is invisible and nothing is unusable. It is off-brand on the
primary input of a manager-facing screen, and **it is the only blue in the product**.

### The blind fix from the previous build was correct

**[OBSERVED]** The "Submit & compare" button renders as ember with near-black text in both themes,
matching the module's other primary buttons.

Recorded as a finding because the point of this build was to convert a "fixed by pattern" claim
into a "fixed and seen" one, and the answer could have gone the other way.

## SCANNER FAILURE, second of the session

My first scan of this class reported **18**. Twelve were false — it truncated each element at the
first `>`, which lands inside `onChange={(e) => …}` and cuts off a `className` that follows. A
rewrite scanning to brace-depth-zero gave 6, and two of those were then excluded by reading them.

That is the second scanner in two builds to produce a wrong number before a correct one — the
previous build's probe reported zero for a class with 56 members. **A count from a scanner is a
hypothesis until its members have been read**, and in both cases reading them took less time than
writing the scanner.

## Observation, not a finding

The report header reads "24 of ~20 done (24 available)" — my fixture put `scored` past the target.
A real manager who scores more than the target would see the same sentence. It reads oddly and it
is not wrong.

## What this does not prove

**The four checkbox fixes were not rendered** — `MeetingCoachingPanel`, `team`,
`finance/contractors`, `finance/controls` have no captures. Fixed by applying an established
convention, not by seeing.

**Six Sales Coach routes remain unrendered**: `/settings`, `/[id]`, `/kpi`, `/training`, `/team`,
`/team-chat`, `/door`.
