# CLOSURE — surface-complete is not reachable

## What shipped

The Breakdown is on the pager a rep opens from their own bottom nav, between Progress and Metrics.
The duplicate sub-nav is deleted and `/my-progress` renders the same component. The milestone strip
that deletion orphaned is back on the Progress pane.

R1 of the sweep's closure is closed.

## What this build got right, and it was not the code

Deleting a component I had written and tested hours earlier rather than moving it. The pager
already WAS the rep's sub-nav; a second one over the same three boards would have been correct on
the day it was written and wrong the first time either gained a page.

The other thing worked without me: `reachability:audit` failed the build by name the moment the
deletion orphaned `PitchMilestones`. That gate was built this session because three modules in one
feature had no caller in one day. It has now caught a fourth, created by a refactor, hours after
the class was re-committed.

## The diagnosis, stated plainly

A31 says schema-complete is not built. This was one seam further out: **surface-complete is not
reachable.** Every step of picking `/my-progress` was reasonable — the sheet showed a sub-nav, that
route had two of the three boards, the name matched. I never asked who can open the route, and the
answer was one line away in a file I had opened that day for something else.

I have cited A31 in six consecutive builds while committing the failure it names. Reading an asset
is not the last gap; applying it is.

## The un-named reliance

- **That the pager's swipe still works with three panes.** The maths is derived and the geometry is
  asserted as numbers. No finger has touched it.
- **That a manager wants a swipe pager on a desktop route.** `/my-progress` now renders it. The
  swipe simply goes unused with a mouse, which is an assumption about an interaction nobody has had.
- **That the nav is the whole answer to reachability.** A rep could still type `/my-progress` — it
  has no server gate — so the page is hidden rather than restricted, and I have treated "hidden
  from the nav" as "cannot reach" throughout.

## Residual

```json
[
  { "id": "R1-nothing-asks-whether-a-route's-audience-matches-its-contents",
    "item": "`managerOnly` is a nav flag. /my-progress has no server gate, so it is neither reachable by reps nor restricted from them. No check relates a page's audience to what it renders.",
    "why_skipped": "A gate would need to know who a page is FOR, which is expressed nowhere — the flag says who sees the link, the page says nothing.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T09:10:00Z",
    "outcome": "OPENED, rated lowest, and it is the gap R1 fell through. reachability:audit proves a module is IMPORTED by something; it cannot prove that something is reachable by the person the module was built for. Every module in yesterday's build was imported, every test passed, every audit was clean, and the route was hidden from the audience. The same question applies to every page added since and nothing swept them." },

  { "id": "R2-the-swipe-has-never-been-performed",
    "item": "Three panes on a real finger. The drag maths runs against synthetic touch events with no layout width, which is why SNAP_MIN_PX exists as a floor.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T09:11:00Z",
    "outcome": "OPENED. The geometry is now derived and asserted as numbers, which is the half that can be checked. The half that cannot: whether a drag that used to travel half a track and now travels a third still feels like a page turn, and whether the edge rubber-band reads right at a boundary that moved." },

  { "id": "R3-a-test-that-could-not-fail",
    "item": "`pageOf` tested for \\\"-50%\\\" and would have reported page 0 for every page of a three-pane track — silently passing every navigation assertion in the file. Eighth instance this session.",
    "why_skipped": "Nothing detects a helper that decodes state from a literal a count determines.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T09:12:00Z",
    "outcome": "OPENED. This one is worse than the seven before it: it was not a fixture that happened not to discriminate, it was a HELPER that every other test in the file depended on. One stale literal in one line would have hollowed out a whole suite while every assertion in it reported success against the wrong page." },

  { "id": "R4-nothing-has-been-rendered-in-a-browser",
    "item": "Tenth consecutive build.",
    "why_skipped": "No browser in the loop.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T09:13:00Z",
    "outcome": "OPENED. The specific thing a browser would have caught this week is no longer a layout question: it is that a board was unreachable. Opening the rep dashboard once would have shown two tabs where the sheet draws three, in about four seconds." },

  { "id": "R5-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the nineteenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T09:14:00Z",
    "outcome": "OPENED. Unchanged." }
]
```
