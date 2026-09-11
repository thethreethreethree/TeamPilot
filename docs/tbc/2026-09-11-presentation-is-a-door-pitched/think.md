---
started_at: 2026-09-11T11:25:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a presentation is a door you pitched, not a door you recorded

## Why (the record)

The founder sent a screenshot of their own door home screen, annotated, asking for two layout
faults to be fixed. A third thing was visible in it that they had not asked about:

    22 of 40 DOORS      0 of 9 PRESENTATIONS      9 of 1 SOLD

Nine sales from zero presentations. Those three figures are drawn as a funnel, one after another in
the order a sale happens, and a funnel asserts containment: every sale came from a presentation,
every presentation from a door.

## The defect

The three stages were counted from two different tables.

`doors` and `sold` come from `door_knocks`. `presentations` came from `pitches` - rows of RECORDED
pitch audio. So a door the rep logged as sold without recording anything counted as a sale and as
no presentation at all.

Not an arithmetic error. Both numbers were correct about what they measured; they measured
different things and were displayed as one sequence.

## What made this hard, and nearly wrong

The current definition is not an accident. `src/lib/data/doorlog.ts` records a **founder decision of
2026-08-28** choosing `pitches` over the `doors_knocked - no_answer` proxy, on the grounds that the
proxy OVER-counts - and confirming it against a real rep: Moses, 41 recorded pitches against 46
non-no-answer knocks.

At a five-door gap that reasoning is plainly right. The sharper measure wins and the looser one is
a proxy nobody needs.

**The gap did not hold.** Measured 2026-09-11:

| rep | spoke to | recorded | sold |
|---|---|---|---|
| Moses Maniquiz | 126 | 50 | 45 |
| Knute Knudtson | 59 | 11 | 6 |
| Anthony a | 38 | 15 | 3 |
| Alejandro Salazar | 23 | 7 | 3 |
| Johns Ramos (founder) | 18 | 3 | 10 |

Moses is 126 against 50, not 46 against 41. And the founder's own row is the one that settles it:
**10 sales from 3 recorded pitches**, a close ratio of 333%. Sales are counted from knocks and the
denominator was counted from audio, so the denominator can be - and is - smaller than the numerator.

A close ratio above 100% is not a definition preference. It is a broken denominator.

## The decision

Put to the founder twice. The first time I offered the change without having swept for an existing
definition, which is why the 2026-08-28 decision only surfaced afterwards. The second time it was
put to them WITH that prior decision and the table above, and they confirmed the reversal: a
presentation is a door where the rep actually spoke to somebody.

Recording the reversal rather than deleting the old reasoning, because the old reasoning was correct
when it was made and the thing that changed is the world, not the argument.

## Ambiguities surfaced, not resolved silently

- `non_decision_maker` counts as a presentation. You pitched somebody; they could not decide. That
  is the founder's stated set ("every outcome except no-answer") and it is written down here so a
  later reader can disagree with it deliberately rather than discover it.
- This makes the recording gap a COACHING problem instead of a silent rewrite of everyone's ratios.
  Moses speaks to 126 doors and records 50; that is worth knowing and was previously invisible,
  because the missing recordings simply shrank the denominator.
