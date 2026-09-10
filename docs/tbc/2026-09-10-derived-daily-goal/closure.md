# CLOSURE - the daily sales goal decides itself

The door tracker shipped correct and delivered nothing: it required a manager-set daily goal, and no
manager has ever set one, so every rep opened it to "No daily goal set yet". The founder saw that on their
phone and asked for the goal to be decided automatically.

The useful part was refusing to design it from reasoning, and then being wrong once anyway. Deriving from
past sales and dividing a company quota are the two obvious answers, so both were measured. The quota is
genuinely null. For the sales I read `coaching_sessions.outcome` - 0 of 73 - and concluded there were none,
which is the wrong table: the door funnel records on `door_knocks.outcome`, and there are 38 sales in it.
The derivation was never affected, because it reuses the engine's own query; the claim in my own notes
was. It was caught by opening the residual I had marked as not mattering.

## What this does NOT do (un-named-reliance half)
- Not observed on a deployment. The derivation is unit-proven and the production data was read directly,
  but nobody has opened the app against this and seen dials instead of the empty panel.
- It does not make the number good. It makes it PRESENT and derived from the rep's own record; whether
  "2 sales a day" is the right ask for this business is a judgement no arithmetic here settles.
- The starter ratios (1 in 4.4, 1 in 9) are doc 06's, not measured from this company. Every
  `own-activity` goal rests on them.
- No backfill: reps with a frozen row from before this change keep whatever that row says for today.

## Residual (A36 - read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-starter-ratios-unmeasured",
    "item": "Every own-activity goal is computed through starter ratios of 1 presentation per 4.4 doors and 1 sale per 9 presentations - figures from doc 06, not measured from this company. It is the assumption I am most likely to have accepted without noticing, because it arrived as a spec constant.",
    "why_skipped": "The company has 613 knocks and 83 pitches, which gives a contact ratio, but ZERO sales - so the close half cannot be measured at all yet.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-10T15:45:00+08:00",
    "outcome": "OPENED. The contact ratio CAN be checked today: 83 pitches over 613 knocks is roughly 1 in 7.4, against the starter's 1 in 4.4 - so the starter assumes reps get a pitch from a door more easily than this company actually does, and an own-activity goal derived through it will run HIGH. The close half is unmeasurable until a sale is recorded. Flagged, not fixed: correcting the contact ratio to the company's own is a real improvement and a separate decision, since it changes every rep's number." },
  { "id": "R2-no-outcomes-recorded",
    "item": "Zero of 73 coaching_sessions carry an outcome, which I read as meaning the derivation could never reach its own-sales basis.",
    "why_skipped": "I took one count from one table as the answer to 'does this company record sales'.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-10T15:58:00+08:00",
    "outcome": "OPENED, and the premise was WRONG. door_knocks.outcome = 'sold' holds 38 rows company-wide, and that is the column the day-target engine counts - so own-sales is reachable today for any rep who has sold a door. The founder's own account has 6 knocks, 0 sold and 2 working days, so it lands on own-activity: 3 doors a day through the starter funnel gives a goal of 1 sale, which the engine turns into 9 presentations and 40 doors. Separately, coaching_sessions.outcome being 0 of 73 remains a real open question - whether the session outcome write is broken or simply unused - and it is surfaced to the founder rather than answered here, because it blanks every money metric on the KPI screen." },
  { "id": "R3-goal-moves-day-to-day",
    "item": "A derived goal is recomputed each morning from a rolling 30-day window, so it can differ from yesterday's without the rep changing anything.",
    "why_skipped": "It freezes for the day, so it cannot move under them mid-shift, and a goal that follows their record is the point.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null }
]
```

## Verification
See check.md - the production reads that ruled out both obvious designs, the targeted suite, and the
whole `npm run check` output with its exit code.
