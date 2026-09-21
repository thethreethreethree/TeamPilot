# CLOSURE — one boolean, and what it took to notice it twice

## What shipped

`readPitchPeriod` returns whether it was truncated. Both routes consume that verdict instead of
recounting rows. The leaderboard says it on screen, to managers and reps alike.

R3 of the leaderboard closure and R5 of the milestones closure are closed by name.

## What this build got right, and it was not the code

Treating a residual recorded twice as a task. The mechanism surfaced the gap correctly both times —
A36's "read hardest where you are most confident" is what produced both entries — and it has no way
to decide that twice is enough. That decision was made here because the second entry was visibly
the same sentence as the first.

## The thing worth being plain about

The line this build replaces is one I wrote yesterday:

```ts
capped: read.pitches.length >= 900,
```

It is a §2.2 violation with both failure modes at once — a copied constant that would drift, and
the wrong array, which made it wrong on the day it shipped rather than merely fragile. I wrote the
§2.2 reasoning into three documents in that same build.

That is the session's clearest evidence for §5 and A22: the citations were fast, correct, and
everywhere, and the code went the other way. Knowing a rule protects less than it feels like it
does.

## The un-named reliance

- **That `max_rows` is 1,000.** The 900 is chosen to sit under a PostgREST setting this repo does
  not hold. If it were lowered below 900, the query would truncate and `capped` would say false —
  the flag would lie, which is worse than not having it.
- **That a caller who ignores `capped` is making a choice.** The breakdown route ignores it. That is
  fine for a rep's own week and not obviously fine for a long window on a busy rep, and nothing
  distinguishes the two.
- **That one boolean is the right shape.** It says truncated, not by how much. A board missing two
  pitches and a board missing four hundred read identically.

## Residual

```json
[
  { "id": "R1-the-cap-has-never-actually-bitten",
    "item": "Every test drives capped through a mock or a small limit. No read of a real table has returned 900 rows, and the notice has never been rendered by real data.",
    "why_skipped": "Needs a seeded company with 900+ scored pitches.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T03:40:00Z",
    "outcome": "OPENED because it ranks highest, and reading it produced a correction to this very document. The flag is computed against `limit`, which is `Math.min(args.limit ?? 500, 900)` — so the DEFAULT bound is 500, not 900. I checked what each caller actually passes rather than assuming: the leaderboard and milestones routes both pass `limit: 900` explicitly, so every '900' in this build's prose is correct FOR THEM. What it is not correct about is the breakdown route, which passes no limit and is therefore bounded at 500 — which makes R3 below a sooner problem than '900' makes it sound. The logic survives; one of my own sentences did not." },

  { "id": "R2-capped-says-truncated-not-how-much",
    "item": "A board missing two pitches and a board missing four hundred produce the same flag and the same sentence.",
    "why_skipped": "Reporting the shortfall means a count query alongside the read.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T03:41:00Z",
    "outcome": "OPENED. The asymmetry matters for the leaderboard specifically: two missing pitches will not reorder a board and four hundred certainly will, and the notice reads identically in both cases. A manager who sees it once on a near-complete period learns the warning is noise, which is how a true warning stops working." },

  { "id": "R3-the-breakdown-route-ignores-it",
    "item": "`/pitch-score/breakdown` reads a period for one rep and neither reports nor surfaces `capped`.",
    "why_skipped": "A rep's own week is far under any bound; the exposure is a long window on a very busy rep.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T03:42:00Z",
    "outcome": "OPENED, and sharper than it first looked. It is the inconsistent one — three routes over one bounded read, two reporting the bound and one silent, which is exactly the state this build objected to when it was two-versus-one the other way. And it truncates SOONER than the others: it passes no limit, so its bound is the 500 default rather than 900. Its averages would be computed over a truncated set, with nothing saying so, starting at 500 pitches in a window rather than 900." },

  { "id": "R4-nothing-has-been-rendered-in-a-browser",
    "item": "The truncation notice, like every other surface built in the last five builds, exists only in jsdom.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T03:43:00Z",
    "outcome": "OPENED. Fifth consecutive build ending on this. The specific new risk is small — one amber line among several on that board — and the accumulated one is not: the leaderboard screen now carries a standing card, a ranked list, a rule line, a skipped-pitches line and a truncation line, none of which has been seen together." },

  { "id": "R5-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the fourteenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T03:44:00Z",
    "outcome": "OPENED, unchanged." }
]
```
