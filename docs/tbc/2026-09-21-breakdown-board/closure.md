# CLOSURE — the aggregator nobody was calling

Before choosing what to build next I counted importers across the pitch-score package. One module
came back with none: `aggregate.ts`. Seventeen passing tests, four exported functions, zero
callers. Every rubric average a rep would ever see was already written and unreachable.

That is why the Breakdown board did not exist. Not half-built — fully built, one layer down, with
nothing above it.

It is the third of these in two days on one feature. The scoring engine had no caller until the
route; the route had no surface until the panel; the aggregator sat behind both. Three is a
pattern rather than a coincidence, and the pattern is what building bottom-up does: finished
components accumulate, nothing reaches them, and the test count rises the whole time. A31 says
schema-complete is not built; the same thing is true of code, and the cheap detection is counting
importers rather than reading the suite.

What was actually blocking it was a type. `AggregablePitch.score` demanded a full `PitchScore`,
and a reader loading pitches out of the database has no `elementBreakdown` — it holds the element
rows separately. Satisfying the type would have meant fabricating one. A fabricated field that
nothing currently reads is still a lie in the data, and the person who later finds a use for it
gets an empty array with nothing marking it as never-real. So the input narrowed to the nine
fields the aggregation actually touches, established by grepping `p.score.` rather than by
remembering, and the aggregator's own seventeen tests then passed unchanged — which is the
evidence the narrowing was neutral rather than the claim.

The reader had a real bug, and typecheck could not see it. The query was built
`.select().order().limit()` and *then* filtered with `.eq("rep_id")`. supabase-js returns a
transform builder from `.order()` and `.limit()`, and that builder has no `.eq()` — so it throws.
It passed the typechecker only because the injected client is an un-generic `SupabaseClient`,
which loosens the whole chain to `any`.

It was caught because the test records **which filters were applied**, not which rows came back.
A test asserting on output would have been handed the fixture either way and passed. What it
would have shipped is the worst thing available on this surface: a rep's board showing the whole
company's averages as their own, with no error anywhere and no way for them to tell.

The rest of the build is about one question — what is this board *for*. The honest answer is:
telling a rep the one thing worth practising this week. Thirty accurate percentages is not that.
It is the same data with the decision handed back to the reader, and a rep who opens it twice
stops opening it.

So the opportunity is ranked by **points lost**, not by miss rate. An 8-point element missed half
the time costs four points a pitch; a 2-point element missed entirely costs two. Rate-ranking
sends the rep after the smaller prize, and it reads as being nagged about something that barely
counts. It is stated in points and in the period's own terms — *"adds 2.2 points per pitch, about
40 points across your 18 counted pitches"* — because a percentage is accurate and unactionable.
And a gap under a tenth of a point is not shown at all, because a rep doing well must not be
handed a target that cannot move.

The reconciliation is printed on the screen: base plus bonus minus violations equals the average.
The launch checklist requires that identity to hold; printing it is what makes it checkable by the
person most likely to notice, which is the rep whose number it is. It is also why the aggregation
runs on the server — thirty element rates over up to five hundred pitches would mean shipping a
rep's entire scoring history down the wire to draw six bars, and a second implementation of the
averages is how the identity quietly stops holding.

One limitation is accepted rather than hidden. The period filter uses the server's clock, so
"Day" means the last twenty-four hours and not the rep's calendar day; a rep near midnight will
disagree with it. The door log already solved this properly with a device timezone and a computed
local sales-day, and this board has no such input. Approximating a calendar day badly is worse
than a rolling window that says what it is.

---

## Residual

```json
[
  { "id": "R1-no-real-aggregate-has-ever-been-computed",
    "item": "Every number the board can display has come from a fixture. No real pitch has been scored, so no real average exists, and no browser has rendered the board.",
    "why_skipped": "Depends on a real recording scored against live DeepSeek, which needs the founder's go-ahead.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T15:30:00Z",
    "outcome": "OPENED, and it is the same headline as the last three builds. What the fixtures establish is that the arithmetic is right; what they cannot establish is whether the opportunity callout picks something a rep would agree is worth practising. That is a judgement about real grades on real doors, and the first week of real use is the only thing that answers it." },

  { "id": "R2-day-is-a-rolling-24-hours-not-the-rep-s-day",
    "item": "The period window is computed from the server's clock. 'Day' means the last 24 hours; a rep near midnight sees a window that disagrees with their own sense of today.",
    "why_skipped": "Doing it properly needs the device timezone, which this board does not receive. The door log already has the machinery (deviceTimeZone + computeLocalSalesDate) but wiring it here is a change to the route's contract.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T15:31:00Z",
    "outcome": "OPENED. It looks small because the numbers are close most of the time. The reason it may not be: the board's whole job is to be trusted, and the first disagreement a rep notices between it and their own memory of the day is the thing that decides whether they trust the rest of it. The shape of the fix exists in the codebase already; the reason not to guess is that a wrong timezone is worse than an honest rolling window." },

  { "id": "R3-the-team-view-exists-in-the-route-and-has-no-surface",
    "item": "The route accepts an arbitrary repId, and RLS lets a manager read any rep in their company. Nothing renders that — there is no team breakdown, and no way for a manager to pick a rep.",
    "why_skipped": "The manager-side board is Coach Assessment's job and depends on decisions about what a manager should see per rep versus in aggregate.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T15:32:00Z",
    "outcome": "OPENED, and it is a NEW half-built thing created by this build rather than an inherited one, which is worth saying plainly given that this build exists because of exactly that pattern. The capability is reachable by URL and by nothing else. It is smaller than the previous instances — a manager cannot be misled by a surface that does not exist — but it is the same shape, and naming it is the only thing that stops it becoming the next orphan somebody finds by counting importers." },

  { "id": "R4-CLOSED-a-duplicated-lowest-section-helper-was-found-and-removed",
    "item": "The board shipped its own lowestSectionId, four lines, identical in signature and behaviour to rubric.ts's lowestSection. Found by sweeping for duplicates while writing this residual.",
    "why_skipped": "NOT skipped — removed. The component now imports the authority.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T15:33:00Z",
    "outcome": "CLOSED IN THIS BUILD. Recorded rather than deleted from the record, because it is the THIRD §2.2 duplicate found in one session — the manager predicate, the section totals, and now this — and in all three the copy agreed with its authority on the day it was written. That is what makes the class invisible: a duplicate is never wrong when you write it. The honest note is that I wrote this one AN HOUR after removing the manager-predicate copy and citing §2.2 while doing it, which says the clause is easier to apply to other people's code than to the file currently open." },

  { "id": "R5-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the sixth build.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T15:34:00Z",
    "outcome": "OPENED. This build added two more decisions it may already have settled — how the biggest opportunity is ranked, and what the period windows mean. Eleven now." }
]
```
