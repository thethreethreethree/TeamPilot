# BUILD — the rude-flag review queue

## What was built

The first row of "Needs your attention", which has read *"Rude-or-dismissive flags are not wired
into this list yet"* for three builds.

| Landed | |
|---|---|
| `reviewFlags.ts` | `REVIEW_FLAG_IDS` derived from the rubric, `readReviewFlags`, and the two answers as the values the override route already takes |
| dashboard route | reads the flags best-effort, returns `null` on failure and `[]` on none |
| `ReviewFlagQueue.tsx` | the card, the evidence, the reason box and the two answers |

**No migration. No new table. No new endpoint.** Every part of the write side already existed.

## The design, and the thing it turns on

Remove changes the score. Confirm changes nothing — so where is a confirmation recorded?

The obvious answer is a `reviewed_at` column on the event. That is a **second record of a decision
the override log already holds**, and the two drift the first time one is written without the
other. So **confirm is also an override**: `new_value: 'awarded'` at the same points, with a
reason. A no-op to the arithmetic and a real entry in the record.

Two things fall out of that, and both are better than the column would have been:

1. **"Has a human looked at this?" becomes "does an override row exist for this (pitch, item)?"**
   No status field, nothing to keep in step, and the queue is *defined* as flags without one — so
   a reviewed row leaves it by construction rather than by remembering to mark it.
2. **The rep gets told either way.** A flag that simply goes quiet tells them nothing. The
   override route already notifies them and already carries the reason, so a confirmation reaches
   the rep as *"a person listened and agreed, and here is why"* — which is the only thing that
   makes a −10 for rudeness survivable (§3.3).

## Why this violation and no others

The rubric lists five. Four are arithmetic. One is not:

> **Rude, dismissive, or condescending to the customer · −10 · "Any instance; flag for manager
> review"**

It is the largest single deduction in the rubric, bigger than any bonus, and it rests on an LLM's
reading of someone's manner. `rubric.ts` has carried `flagsForReview: true` since it was written,
with a comment quoting that line — and **nothing has ever read it**.

`REVIEW_FLAG_IDS` is therefore **derived** from `VIOLATIONS_BY_ID` by reading the field, never
listed. A second violation gaining `flagsForReview` appears in this queue without anyone editing a
constant (§2.2, A30).

## Four decisions in the card that are about the person, not the pixels

- **The evidence is shown.** A card offering *Remove* without what the scorer actually heard asks a
  manager to judge someone's manner from a category name. The rubric wants a judgement, not a
  rubber stamp.
- **Both answers cost the same.** Confirm requires a reason exactly as Remove does. If upholding
  the flag were the cheaper click, the path of least resistance would be to uphold it — the wrong
  bias for the one deduction the rubric singles out.
- **The manager is told the rep will read it**, at the point of writing rather than afterwards.
- **A failed read is not an empty queue.** They render identically and mean opposite things, and on
  this card the wrong one reads as reassurance: *nobody has been rude this week*, when the truth is
  *nobody looked*.

## The mistake I made while building it, for the third time today

`reviewFlags` is a new field on an existing response, and I wrote the component with
`flags === null`. Six existing board tests went red with
`Cannot read properties of undefined (reading 'length')`.

This is the **third** wire-boundary crash today — after `events` and `comparison` on `PatternRow`
— and the first two are the ones I wrote the defence for. A browser holds its JS bundle across a
deploy, so a client compiled against today's fields is routinely handed yesterday's JSON.

Hardened to `if (!flags)`, with the type widened to `ReviewFlag[] | null | undefined` and the
reason at the declaration. All three states mean *"I do not have this list"* and all three say so.

Worth naming because it is not a knowledge gap: I had written that exact defence twice in the same
session and then added a field without it. The habit that produces it is **shipping the read and
the surface together and treating the response shape as a fact rather than a promise**.

## Four-layer trace (§1.5.1)

**1 — Structure.** A pure set derived from the rubric, one read, one card. Nothing new in the
schema and no second writer.

**2 — Effectivity.** Both answers write through the authority and recompute through `scorePitch`;
removing a flag moves the rep's total, band, prize eligibility and the team average, because it
goes through the same path a dispute correction does.

**3 — Composition.** The row leaves the queue on either answer because the queue is *defined* as
flags without an override. The manager's next action is to move on, and the board re-reads.

**4 — Surface.** The board's own words: *"Pitch on Thu 17 Sep, −10 applied. Confirm or remove."*
with a Review button, in the red-tinted attention row the mockup draws.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Two sources were opened at full resolution earlier today and are quoted here: the manager
dashboard board and the rubric PDF (p.6).
