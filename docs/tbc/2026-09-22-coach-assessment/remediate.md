# REMEDIATE

### I reported "gate passed, exit 0" from the wrong command's exit code

gate-or-promise: gate
- Mechanical and one line: the gate now runs as `npm run check > log 2>&1` on one line and
  `echo "CHECK_EXIT=$?"` on the next, with no pipeline between them, so the echoed value is the
  gate's own status. A pipeline can no longer stand between the command and its verdict.
- The wider rule is A38's and already exists: report the CANONICAL command by name and paste what
  it printed. What this adds is that "what it printed" must include the exit line, because a
  green-looking tail is not an exit code — the failing run's last visible line was a ✓.
- **The hole:** nothing stops a future run from being wrapped in a pipeline again. It is a habit,
  not a checker, and a checker for "how the agent invoked its own shell" has no precise form.

### The guide's `rep_activity` already exists as a view, with more columns

gate-or-promise: gate
- Already gated, and it fired: INVARIANT 28's sibling check — *"a finance table must be reachable
  from the product"* — failed with `rep_activity exists and is never named in src/`. That is the
  check catching a table that should not have been created, from the other direction.
- The durable record is the deletion plus this file. 0259 never reached production, so there is no
  drift to reconcile and no ledger entry to unwind.
- **What would have caught it sooner:** searching for the CONCEPT before accepting the guide's
  name for it. I grepped for `rep_activity` (nothing) and for tables matching `door|activity|knock`
  (found `door_knocks`), and stopped. `rep_kpi_daily` matched neither pattern because it is named
  for what it reports rather than for what it counts. The sweep that found it was
  `grep -rn "doorsKnocked" src/lib/`, from the code side rather than the schema side — and that is
  the generalisable move: search for the NUMBER, not the table.

### I wrote the duplicate this file's own header warns about

gate-or-promise: declined
- Declined honestly. A checker for "this function already exists somewhere else under a different
  name" is the halting problem with extra steps, and a fuzzy one would flag every pair of
  functions that both divide. A30 is explicit that a gate must be precise or not exist.
- What replaces it is the same move that found it: before writing a calculation, grep for its
  OUTPUT name — `doorToPresentation`, `closeRate` — rather than for the function you are about to
  write. That found both duplicates in this build within one command each.
- **The hole, stated plainly:** I documented this class in a header and then violated it directly
  beneath, in the same file, in the same hour. Knowing the rule demonstrably does not prevent the
  behaviour, which is A22's own finding one level out. The only thing that caught it was reading
  `aggregate.ts` for an unrelated reason.

### A team average that would not have summed to its rows

gate-or-promise: promise
- A promise, and a weak one: nothing asserts the launch checklist's "rep totals sum to team
  totals" at runtime or in a test, because the read layer has no test yet — it is the next build,
  with the page.
- The identity is currently true by construction (the team aggregates the same attributed set the
  rows are built from, and `sumTeamTotals` sums the rows) and by `unattributed` being reported
  rather than absorbed. A test that seeds two reps and asserts the sum is the thing that would
  make it a gate, and it belongs with the read-layer tests.
