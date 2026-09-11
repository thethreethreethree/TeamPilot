# CHECK - a presentation is a door you pitched, not a door you recorded

## Findings

### F1 - one funnel, two tables
class: same-concept-two-sources (one displayed sequence whose stages are counted from different tables)
sweep: grep every assignment of `presentations` and `conversations` across src/lib and src/app/api, then read what table each one queries
severity: high

`doors` and `sold` came from `door_knocks`; `presentations` came from `pitches`. Drawn as a funnel,
which asserts containment the two sources cannot guarantee. It reached the founder's home screen as
"0 of 9 PRESENTATIONS" beside "9 of 1 SOLD".

Measured rather than supposed: 86 pitch rows against 264 spoken-to knocks across 723 knocks.

### F2 - the fix reverses a prior founder decision, with evidence on both sides
class: superseded-decision (a recorded decision whose supporting measurement no longer holds)
sweep: grep the codebase for a dated founder decision on the same concept before changing it
severity: high

`doorlog.ts` records a founder decision of 2026-08-28 choosing `pitches` precisely BECAUSE
`doors_knocked - no_answer` over-counts, confirmed against Moses at 41 recorded / 46 non-no-answer.

That is a five-door gap. It is now 126 / 50, and the founder's own row is 18 spoken to, 3 recorded,
10 sold - a 333% close ratio. The old decision was right on its own data; the data moved.

**The first time I put this choice to the founder I had not run this sweep**, so they answered
without knowing a contradicting decision existed. That is the finding: the sweep belongs BEFORE the
question, not after it.

### F3 - three surfaces disagreed, and the disagreement was invisible
class: duplicated-rule (one rule implemented separately in more than one place)
sweep: grep every presentations assignment; compare the expression, not the name
severity: medium

`teamTrainingBrief.ts` has always used `Math.max(0, knocked - noAnswer)` - the very definition the
2026-08-28 decision rejected. So a manager's training brief and a manager's coach-assessment page
have been reporting different presentation counts for the same rep, and nothing surfaced it.

Now all four agree, and the one that already matched needed no change.

### F4 - the test stub distinguished the queries by TABLE
class: stub-couples-to-implementation (a mock that encodes how the code works, not what it promises)
sweep: run the affected suite after the change and read what it reports, rather than assuming a suite with no failures is a suite that still covers the code
severity: low

The stub resolved counts with `table === "pitches" ? presentations : outcomeSold ? sold : doors`.
Moving all three onto one table would have made two of them resolve identically. It failed loudly
instead, because `.neq` was not on the builder at all - but had `.neq` happened to exist, this would
have passed while testing nothing.

## What I did NOT do

Nothing backfills `rep_day_target`. A target frozen earlier today keeps the presentations target it
was computed with. See the closure.

## Verification

  $ npx vitest run src/lib/coach/doorlog
  Test Files  18 passed (18)
  Tests  123 passed (123)

  $ npm run check
  (typecheck, lint, theme:audit, rls:audit, invariant:audit, tbc, test)
