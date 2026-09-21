# CLOSURE — flagged is not asked

## What shipped

A rep no longer sees their rank, the size of the field, or the gap to the rep below. They see their
own totals and one distance: how far behind the rep immediately above. Stripped at the route.
Section L is resolved on the record.

## What this build got right, and it was not the code

Nothing in this build was a good decision of mine. The good decision was the founder's, and the
only thing I did well was put it to them — three builds later than I should have.

The thing worth keeping is the shape of the ruling, because it is better than my answer and not
merely more authoritative. I had been asking **how much** ranking a rep could see, and setting the
dial myself each time at the point I could defend. The ruling asks **is this a target or a
position** — a distance you can close is a goal, a rank and a cushion are positions — and that line
keeps the competition meaningful while removing exactly what the KPI document was protecting
against.

## The un-named reliance

- **That a rep with one distance still has a competition.** The ruling's reasoning is that a target
  beats a position. That is a claim about people and nothing here tests it; if it is wrong, the rep
  view is now flatter than either document intended.
- **That "the rep above" is the right comparison at all.** It is the one survivor of three
  comparisons and it was never separately justified — it survived because it was the least
  positional of the three, not because anyone chose it.
- **That the ruling applies only where I had already made calls.** It is a general rule about two
  documents. I applied it to the leaderboard. Nothing swept the rest of the product.

## Residual

```json
[
  { "id": "R1-the-ruling-was-applied-only-where-I-had-already-decided",
    "item": "The founder ruled generally: the KPI document wins on anything a rep sees. I applied it to the three calls I had already made. Nothing swept the product for other places the sheet and the KPI document disagree.",
    "why_skipped": "A sweep means re-reading both documents against every rep-facing surface, which is its own build.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T05:40:00Z",
    "outcome": "OPENED, and it is the most likely place for this to recur. The three conflicts I found were the three I happened to walk into while building; there is no reason to think that is all of them. The Arena, the breakdown board and the correction alert are all rep-facing and were all built before the ruling existed. A sweep is a real task and it is not done." },

  { "id": "R2-a-negative-assertion-passes-for-free",
    "item": "Three fixtures in three builds asserted that something was absent, against inputs where it would have been absent anyway. Each was caught by mutation, none by reading.",
    "why_skipped": "No mechanical check distinguishes a fixture that proves absence from one that cannot produce presence.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T05:41:00Z",
    "outcome": "OPENED. Three in three builds is a rate, not a coincidence, and the common shape is now written down: a negative assertion is free unless the input makes the positive REACHABLE. What makes this uncomfortable is that all three tests read well — each says in its name exactly what it means to guard, and each was wrong about whether it did. The only thing that found them is mutation testing run by hand, which means the rate is a lower bound: it is three among the units I chose to mutate." },

  { "id": "R3-the-class-has-no-gate-and-the-guard-cannot-see-it",
    "item": "Resolving a conflict between two authorities instead of escalating it. The decision-picker guard fires on a MESSAGE that offers a choice in prose; it cannot fire on a decision that was never offered.",
    "why_skipped": "A gate would have to recognise that two documents disagree, which is a judgement about prose. The nearest mechanical version would be gameable by phrasing.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T05:42:00Z",
    "outcome": "OPENED and rated lowest, because it is the finding the whole build is about. Each of the three resolutions was RECORDED — 'a concession, not a resolution', 'my inference, not a stated requirement' — in documents the founder can read. I treated writing it down as discharging it. It does not: a residual is a note to myself that the founder may never open, and a picker is a question they must answer. Flagged is not asked, and the gap between those two is where all three of these lived for two days." },

  { "id": "R4-nothing-has-been-rendered-in-a-browser",
    "item": "Seventh consecutive build. The standing card changed shape today — it leads with a number rather than an ordinal — and neither version has been seen.",
    "why_skipped": "No browser in the loop. The founder has chosen a self-audit density pass instead, which is the next task.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T05:43:00Z",
    "outcome": "OPENED. Status changed: this is no longer purely blocked, because the founder has directed a density self-audit. That does not close it — reading my own markup cannot tell me what the page LOOKS like, and I said so when it was offered — but it converts an indefinite wait into a task with a defined limit, which is better than carrying the same sentence an eighth time." },

  { "id": "R5-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the sixteenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T05:44:00Z",
    "outcome": "OPENED. Pointed now in a new way: this build exists because two documents in the tree disagreed and the founder had to say which wins. There is a third instruction, from the founder directly, that has never been read at all." }
]
```
