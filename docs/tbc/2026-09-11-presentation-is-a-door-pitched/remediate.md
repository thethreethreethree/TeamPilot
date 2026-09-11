# REMEDIATE - a presentation is a door you pitched, not a door you recorded

### F1 - one funnel, two tables
gate-or-promise: gate

All four presentation counts now read `door_knocks` (or the faithful `rep_kpi_daily` rollup of it),
filtered to outcomes other than `no_answer`. The existing `dayTargetData` suite covers the ratio
window and passes with the stub taught to tell the three filters apart.

What the gate does NOT cover, named rather than implied: nothing asserts that a future fifth surface
counts presentations the same way. The protection is that all four now sit on one table with the
same filter, so a new one that reaches for `pitches` looks wrong beside them rather than looking
normal.

### F2 - the fix reverses a prior founder decision
gate-or-promise: promise

No gate. A decision cannot be asserted by a test, and the honest protection is that the reversal is
written into the code at the point of use: `getAllTimeKpi`'s header carries both decisions, the
measurement that justified each, and the date. A future reader who disagrees can disagree with the
argument rather than rediscover it.

The promise is procedural and it is mine: sweep for an existing dated decision BEFORE putting a
definition question to the founder, not after they have answered it.

### F3 - three surfaces disagreed
gate-or-promise: gate

The four expressions are now identical in meaning and each cites the same dated decision, so a diff
that changes one without the others is visible in review. `teamTrainingBrief` needed no change,
which is the evidence that the new definition is the one the system already half-believed.

### F4 - the test stub distinguished by table
gate-or-promise: gate

The stub now watches the FILTER (`.eq("outcome","sold")` versus `.neq("outcome","no_answer")`),
which is what the three queries actually differ by. Its comment says why, so the next person moving
a query between tables is told what the stub is keying on before they trip it.
