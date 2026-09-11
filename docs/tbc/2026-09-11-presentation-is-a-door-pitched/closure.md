# CLOSURE - a presentation is a door you pitched, not a door you recorded

The founder sent a screenshot to have two layout faults fixed. The thing worth the day was the one
they had not circled: nine sales from zero presentations, on their own home screen.

It was not a calculation error. Both numbers were right about what they measured. `doors` and `sold`
came from the knock log; `presentations` came from recorded audio; and the three were drawn as a
funnel, which promises that each stage contains the next. Two honest numbers, one dishonest shape.

What nearly made this a bad change is that the existing definition was chosen deliberately. A
founder decision of 2026-08-28 picked recorded pitches over doors-spoken-to precisely because the
looser measure over-counts, and confirmed it against a real rep: 41 against 46. At a five-door gap
that is the better call and I would have made it too.

The gap is now 126 against 50. And the founder's own row - 18 doors spoken to, 3 recorded, 10 sold -
produces a close ratio of 333%, because the numerator comes from knocks and the denominator came
from audio. That is not a definition to prefer or not prefer; it is a denominator that can be
smaller than its numerator.

So the reversal is right, and the old reasoning is kept beside it rather than deleted, because the
argument did not fail - the world it described did.

The process failure is mine and it is recorded in the check: I offered the choice before sweeping
for an existing decision, so the founder answered the first time without knowing they were
reversing themselves. They answered again with the prior decision and the per-rep table in front of
them. A definition question gets the sweep BEFORE the question.

The quiet win is F3. `teamTrainingBrief` has always counted presentations as knocks-minus-no-answer
- the definition the 2026-08-28 decision rejected - so a manager's training brief and a manager's
coach-assessment page have been reporting different numbers for the same rep, and nobody could see
it. Four surfaces now agree, and the one that needed no change is the evidence that the system
already half-believed this.

And the gate earned its keep twice today: the TBC freshness check refused this change for want of a
build directory, which is the only reason the 2026-08-28 decision was found before it shipped
rather than after.

## Residuals

```json
[
  { "id": "R1-frozen-targets-keep-the-old-presentations-number",
    "item": "rep_day_target is frozen per rep per local day, so a target frozen before this change keeps the presentations target computed under the old definition.",
    "why_skipped": "Recomputing a frozen target intra-day is the exact thing the freeze exists to prevent - a target that moves during the day rewards stopping.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-11T11:47:00+08:00",
    "outcome": "OPENED, and the high confidence was misplaced twice over, which is the whole argument for reading from the top of this ranking. FIRST, the premise was wrong: the newest frozen row is 2026-09-10 and there is none for today, so nothing is frozen under the old definition and the next open computes fresh. SECOND, and much more important, opening it surfaced a behavioural change this build had not identified at all. `qualified` requires 10 presentations, so raising the count flips reps from the STARTER ratios to their own: Alejandro Salazar (7 recorded to 23 spoken) and the founder (3 to 18) both cross it. Their door target for a one-sale goal moves from 40 to 25 and to 20 respectively - the founder landing on DOORS_FLOOR. build.md claimed the door target barely moves; that is true only for a rep already qualified, and it has been corrected rather than left standing." },

  { "id": "R2-the-founders-own-ratios-are-built-on-test-data",
    "item": "The founder now qualifies for his own ratios on 10 sales from 29 doors - a 34% door-to-sale rate that is logged test data, not selling. The system will believe it and hand him a 20-door day.",
    "why_skipped": "Nothing in the code can tell a logged test knock from a real one, and inventing a heuristic for it would be worse than the problem. DOORS_FLOOR = 20 bounds how far wrong the target can go.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-11T11:48:00+08:00",
    "outcome": "OPENED because it is the founder's own account and he will see it first. The honest position: this is not caused by the change - his ratios were already junk, the change only makes the system act on them. Before today he was below the qualifying minimum and so received the starter numbers by accident rather than by design. Flagged to him directly rather than buried here." },

  { "id": "R3-the-recording-gap-is-now-visible-and-unaddressed",
    "item": "Moses speaks to 126 doors and records 50. The founder records 3 of 18. Until now that gap silently shrank the presentations denominator; it is now visible in the ratios but nothing asks anyone to close it.",
    "why_skipped": "It is a coaching problem, not a code one, and inventing a nag for it was not asked for. What changed is that the gap no longer rewrites everybody's close ratio while staying invisible.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-11T11:42:00+08:00",
    "outcome": "OPENED and left open deliberately. Two thirds of Moses's conversations have no audio, so two thirds of his coaching cannot happen. It belongs on the founder's decision board as a question about recording discipline, not in a commit. Recorded here so it is not quietly lost now that the number it distorted has been fixed." },

  { "id": "R4-non-decision-maker-counts-as-a-presentation",
    "item": "An outcome of non_decision_maker counts toward presentations. You pitched somebody who could not decide.",
    "why_skipped": "It is the founder's stated set - every outcome except no-answer - and both readings are defensible. Written down so a later reader can disagree deliberately rather than discover it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null }
]
```
