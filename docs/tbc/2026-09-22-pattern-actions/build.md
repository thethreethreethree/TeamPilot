# BUILD — the writers, and the notes a rep is promised

## What this actually unblocked

Four buttons, on the face of it. Underneath, **three of the five pattern statuses were
unreachable.**

`statusOf` returns `coaching`, `improving` or `stalled` only when `coachedAt` is set, and
`coachedAt` is derived from a `pattern_events` row of kind `coached`, `drill_assigned` or `note`.
Nothing in the product had ever written one. So every pattern was New or Fixed, the Stalled rule
could not fire, the Improving comparison was computed and never displayed under its own status,
and the Rep progress timeline drew bars with no markers on them.

That is A31 at its largest in this cycle: five screens of correct code standing on a table with
no writer. The 0258 closure flagged it the day it shipped, and it still took three builds.

| Landed | |
|---|---|
| `eventPermission.ts` | who may append which kind — the whole access rule, unit-tested without a database |
| `POST /patterns/event` | the first writer `pattern_events` has ever had |
| `PatternActions.tsx` | COACHING NOTES, the four buttons, and the rep's reply |
| `readPatterns` | events now carry `actorId` and `body` |
| `patterns` route | `viewerId` and `nameByActor`, so a note has an author and not a uuid |

## The access rule, and why it is a module

0258 gives `pattern_events` **no RLS insert policy at all**. Every write is server-side, which
means this route is not *checked by* the access rule — it *is* the access rule, with no database
behind it to catch a mistake.

A rule in that position gets read by reviewers, copied into the next write path, and drifts. So
it lives in `eventPermission.ts`, consumed as a verdict:

```
manager   coached · drill_assigned · note · fixed
rep       rep_reviewed · note · clip_disputed      (own pattern only)
```

**Each half protects something specific.** A rep marking their own pattern coached makes the
Stalled rule unfalsifiable — "coached 7+ days ago with no change" is a claim that a human
intervened, and a rep who can assert the intervention can clear their own status. A rep writing
`fixed` is the streak rule bypassed by assertion. And a manager writing `rep_reviewed` turns the
Ⓡ marker and the "Rep reviewed 2/2" tile into a record of the manager's own opinion, which is A10
exactly inverted: the tile exists to say the *rep* saw it.

`note` is the one kind both may write, because the board draws them as peer entries in one list.

**A manager on their own pattern gets both sets.** Managers run pitches here and are ranked beside
their reps; denying this would leave them the only person who cannot answer their own coaching.

**One refusal message for every denial.** Splitting it into "not a manager" and "not your pattern"
would let a rep enumerate which patterns exist and whose they are — the 404-vs-403 leak, one layer
up.

## A manual close writes the column, not just the event

`statusOf` decides Fixed from `patterns.fixed_at` or a five-clean streak. So "fixed" appends its
event **and** sets `fixed_at` — guarded on the existing value, because closing an
already-closed pattern would restate when the rep fixed it and skew every days-to-fix average on
the Rep progress board.

Writing only the event would have created a second authority on the one fact four surfaces
consume, which is §2.2 with the stakes turned up: the log would say closed and every board would
say open.

## A note is an event with a body

`isNote` is imported by the surface rather than re-expressed there. The **kind** decides the
timeline marker; the presence of a **body** decides whether the row also appears in COACHING
NOTES. One "Mark as coached" carrying an instruction is both — which is exactly what the render
shows: the manager's entry reads as coaching, not as a separate memo filed beside it.

Classifying twice would produce a marker with no words, or words with no marker.

## The rep half, shipped in the same commit

The board's own banner is the brief:

> Reps see their own Pattern Interrupt page, **clips and your notes included**, so nothing here is
> a surprise.

That is A10 written as product copy. So the rep sees every note, replies in the same list, can
flag a clip as wrong, and — once coaching has actually happened — can mark it reviewed. The render
shows that reply as a peer entry: *"Reviewed. Running it before shifts this week."*

It is also the §3.3 participation this feature was missing. Until now the system found a pattern,
a manager read it, and **the person it was about had no way to answer.**

The rep is not offered "Reviewed" on an uncoached pattern, because the tile counts against coached
patterns and acknowledging nothing would render "1 of 0".

The manager is told, at the point of writing and not afterwards, that the rep will read it.

## "From the tape"

The board draws three clips with play buttons inline. This links to the Recordings tab that
shipped this morning instead, where every miss on the pattern is already a marker. One place
decides where a pattern moment sits in a recording; duplicating the player here would be the
fourth surface to hold that opinion.

## Four-layer trace (§1.5.1)

**1 — Structure.** The rule is a pure module; the route is auth and IO; the surface renders. No
new table — 0258 anticipated all six kinds.

**2 — Effectivity.** Pressing "Mark as coached" moves the pattern from New to Coaching, and the
surface re-reads rather than patching its own copy, because the status is the server's derivation.

**3 — Composition.** The manager's next action after coaching is to see it land, and it lands in
three places at once: the pill, the notes list, and the Rep progress timeline's Ⓒ marker.

**4 — Surface.** The four buttons in the board's order and words, COACHING NOTES with author and
date, and "Schedule check-in" disabled with its reason — the same sentence it carries on the Rep
progress board, so the product does not contradict itself across two tabs.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
One source was opened and described at full resolution before any code was written:
`Pattern Interrupt  manager Patterns (web).pdf` — 1 page, 1,832,671 B, opened 2026-09-22.
