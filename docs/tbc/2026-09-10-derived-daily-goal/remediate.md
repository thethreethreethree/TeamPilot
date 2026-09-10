# REMEDIATE - the daily sales goal decides itself

### F1 - the screen that answers "how many doors today" was answering "ask your manager"
gate-or-promise: gate
`deriveDailySalesGoal` supplies a goal when no manager row exists, from the rep's own sales if they have
any, otherwise from their own doors per working day run through the starter funnel, otherwise from doc
06's starter figure. `dayTargetData` reads the counts before settling the goal and stores the effective
one on the frozen row.

The gate is `deriveGoal.test.ts` (9 tests) plus two rewritten in `dayTargetData.test.ts`. The rewritten
pair is the important half: one of them asserted the OLD empty-state behaviour and passed happily while
every rep saw nothing.

### F2 - both obvious sources for a derived goal are empty in fact
gate-or-promise: declined
No gate, and the hole is named: this is a fact about the CONTENT of a live database, not about code, and
nothing static can assert that a column will still have rows in it next month. What is gated instead is
the consequence - the derivation degrades through three bases and its floor of 1 is pinned by test, so an
empty column produces a starter goal rather than a zero or a crash. If outcomes start being recorded the
derivation upgrades itself to `own-sales` with no code change.
