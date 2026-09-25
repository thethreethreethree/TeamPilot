# THINK — two more routes, and what an exact-string edit misses

started_at: 2026-09-24T10:45:00Z

## The task

`/settings` and `/training`, next by size from the residual, in a render pass the founder chose
this morning. Interrupted mid-way by a live outage (see
`docs/tbc/2026-09-24-one-bad-recording-ended-the-run/`), resumed after it was pushed.

## What was expected

`/settings`: nine white-alpha sites, eleven raw tints, and TWO TABS — Account for everyone,
Coaching for managers only.

`/training`: six sites, and a branch structure I had not seen before — **the screen is chosen by an
HTTP STATUS**. `/coach-assessment` 200 → the manager's team view; **403 → the rep's own view**;
anything else → an honest error, because the page's own note at :282 says a 5xx must not silently
demote a real manager to the rep view.

That last one is worth naming: a fixture that returns 200 for everything can only ever render one
of the three. Status-as-branch is the same trap as Standard/Expert with an extra edge, because
nothing in the component's props hints that the other two exist.

## Two harness gaps, each checked before it was worked around

`/settings` rendered as a single empty `<div>`. Two providers throw by design outside their
context — `useTheme` ("Throwing here surfaces the bug at the call site") and `useToast` ("Mount it
once at the layout root") — and a throw during render unmounts the tree.

**Both were verified as harness gaps rather than assumed.** `layout.tsx:144` and `:8` mount both
providers around the whole app, so production is fine. That check mattered: "the page renders
nothing" is exactly what a real crash looks like, and on a 1060-line settings page reached only by
a manager, a real one could sit there a long time.

## The thing this build is actually about

A defect in a component the page mounts but does not contain, carrying an alpha value one hundredth
different from the one every previous sweep matched.
