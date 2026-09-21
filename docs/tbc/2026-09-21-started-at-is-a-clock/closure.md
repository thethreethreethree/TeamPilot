# CLOSURE — started_at is a clock, and I had been using it as a counter

## What shipped

A truncation notice on the Breakdown board, closing the last of three routes over one bounded read
that could report part of a period as if it were the whole one.

And, found on the way to writing the record for that: `started_at` — the field the TBC gates use
both to order builds and to decide whether a claimed read happened during the session — had been
inflated in 159 of 319 records, starting with the directory that installed the gates.

## What this build got right, and it was not the code

Widening before fixing. The one-day measurement gave a clean, damning story — eight evenly spaced
future timestamps, a counter dressed as a clock — and it was true of those eight. Applied to the
whole repo it would have been written onto 74 records where it was false: those are a real clock
reading with the wrong suffix, by an author on UTC+8 writing `Z`. Two causes, opposite remedies,
and the confident version of the finding could not tell them apart.

The second thing: not rewriting the 153. A commit that corrected them would have produced a quiet
gate, a tidy history, and no remaining evidence that the sort key is what caused the drift.

## The diagnosis worth keeping

The drift was not carelessness, and treating it as carelessness would have produced the wrong fix.
`currentBuildDir()` selects the **latest** `started_at`, so once any record sits ahead of the real
clock, the next honest reading *loses the selection* — the gate re-validates the old dir and the
new record ships unchecked. The field had a ratchet on it. The only way for a new build to be seen
was to declare a time later than the last one, and the last one was already ahead.

That is why the fix is in two parts. The demotion removes the pressure; the gate catches what the
pressure no longer explains.

## The un-named reliance

- **That the commit which adds `think.md` is when the record shipped.** A rebase, a squash, or a
  record written days before it was committed all break that reading. The five-minute grace does
  nothing for those.
- **That the allowlist is the right home for "this start is unreliable".** It now feeds the
  *selection*, not just the check — a coupling that was not designed, only convenient.
- **That 74 records are a timezone mislabel.** Inferred from the eight-hour offset matching the
  author's zone and the population vanishing in September. Nobody was asked.
- **That five minutes is the right grace.** It absorbs the six rounding cases present today. It is
  a number I chose from the data in front of me.
- **That the Breakdown's amber notice is legible.** Twelfth build with nothing rendered, and this
  one adds a fourth bordered callout to a board the previous closure already flagged as dense.

## Residual

```json
[
  { "id": "R1-four-callouts-now-and-still-nothing-rendered",
    "item": "The Breakdown opens with Most improved, Your strongest, Biggest opportunity and now a truncation notice. The previous closure flagged three as a density problem; this build added a fourth without seeing any of them.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T18:26:00+08:00",
    "outcome": "OPENED, and it is worse than when it was first written. R1 of the previous closure said three bordered boxes before a rep reaches their numbers is a density problem that no earlier pass could have caught, because two of the three were new. The correct response to that finding was not to add a fourth. The notice is conditional — it renders only on a truncated period — which is the argument for it, and 'only sometimes makes it worse' is a weak one. This is the twelfth consecutive build shipping a surface nobody has looked at." },

  { "id": "R2-the-153-are-kept-by-my-decision-not-the-founders",
    "item": "153 historical records with false start times are allowlisted and preserved rather than corrected. §3.1 supports it, but the choice was mine.",
    "why_skipped": "Correcting them is irreversible and blocks nothing; keeping them is reversible.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:27:00+08:00",
    "outcome": "OPENED. The reversible default was taken so the repo would not go red on a decision the founder had not made, and the decision is put to them in the same turn rather than buried here. What tips it toward keeping: the allowlist entries carry the measured overshoot and the cause, so the record is more informative wrong-and-annotated than it would be silently corrected." },

  { "id": "R3-the-tz-mislabel-diagnosis-was-never-confirmed-by-anyone",
    "item": "74 records classified as a local time written with a Z suffix, on the evidence that subtracting eight hours makes them honest and that the population ends when the convention changed.",
    "why_skipped": "The author is the founder's own prior sessions; there is nobody else to ask.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:28:00+08:00",
    "outcome": "OPENED. Eight hours is the local offset, which is strong, but it is also close enough to a working day that an overshoot of 'this morning to this evening' would look identical. If the classification is wrong the consequence is only the wording of an allowlist reason, not the gate's behaviour — both categories are excluded from selection and neither fails. That asymmetry is why it was safe to ship on an inference." },

  { "id": "R4-a-fourth-call-site-could-still-drop-the-capped-verdict",
    "item": "readPitchPeriod returns `capped`; three callers forward it. Nothing fails if a fourth discards it.",
    "why_skipped": "No precise gate exists — a route may legitimately consume a read whose truncation does not affect its output, so flagging all of them would flag correct code.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:29:00+08:00",
    "outcome": "OPENED and declined deliberately, which is not the same as unresolved. The class took three builds to sweep because each instance was found by reading the next route rather than by anything mechanical. The verdict living in the return type is the construction that helps: forgetting it now requires discarding something rather than failing to compute it." },

  { "id": "R5-the-gate-trusts-the-commit-that-added-think-md",
    "item": "checkStartTimes compares started_at against `git log --diff-filter=A` on think.md. A rebase, a squash, or a record committed long after it was written all break that reading.",
    "why_skipped": "It is the only clock-free anchor available, and the alternative — comparing to `now` — stops seeing a false record the moment the clock passes it.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:30:00+08:00",
    "outcome": "OPENED. The failure direction is the safe one: a rewritten history moves commit dates FORWARD, which makes the check more permissive rather than more likely to cry wolf. A squash could silently excuse a real overshoot; it cannot manufacture a false accusation. Given A30's insistence that a noisy gate is worse than none, erring permissive is the right way round." },

  { "id": "R6-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the twenty-first build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T18:31:00+08:00",
    "outcome": "OPENED. Twenty-one builds. Today's finding was that a field recording whether I had actually looked at something had been filled in with a number instead; the image is the one asset where that question has an unambiguous answer, and the answer is still no." }
]
```
