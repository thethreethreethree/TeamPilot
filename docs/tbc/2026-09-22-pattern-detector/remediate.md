# REMEDIATE

### The boards had never been looked at, and four things built from inference were wrong

gate-or-promise: gate
- The gate is the Evidence Protocol's R7 and it already exists: reading is Phase 0, its artefact
  is `EVIDENCE.md`, and no design or code happens until it is done. What failed was not the rule
  but its trigger — the folder had been read once on 2026-09-21 and a previous EVIDENCE.md sat in
  it, which is exactly the "a summary discharges its source" that R2 forbids and I did anyway.
- What is now different and mechanical: `EVIDENCE.md` records the method **per file** (rendered
  vs extracted) and the md5 of all 11 sources. A re-read can be proven rather than claimed, and a
  changed source is a hash comparison rather than a memory.
- The narrower defect is fixed at the root: the four inferred rules are now quoted from the guide
  with their page, and every value that appears on a board is cross-checked against the code in
  EVIDENCE.md's three-record table.
- **The residual honesty:** nothing prevents the next build from reasoning around a PDF instead of
  opening it. The images opening after twenty-two builds of "cannot be displayed" is the sharpest
  evidence available that a carried residual is not a gate.

### INVARIANT 28 reported a duplicate table named "if"

gate-or-promise: gate
- `stripSqlComments()` runs before `CREATE_TABLE_RE`, with four self-tests beside the existing
  INV28 ones: a CREATE TABLE in a line comment, the exact prose that produced the false positive,
  the phrase wrapped across two comment lines, and a CREATE TABLE in a block comment. Block
  comments are stripped first so a `--` inside one cannot truncate the strip.
- Precise rather than looser: the check keeps full power over real DDL, and a genuine duplicate
  still fails. A30's constraint is the reason this was worth fixing rather than working around —
  an audit that names two unrelated files over a table called `if` is one people learn to skip.

### Six write operations on two new tables had no policy and no allowlist entry

gate-or-promise: gate
- Already gated; `rls:audit` refused the build. The remediation is the record it demanded: six
  entries, each naming the specific forgery it prevents rather than repeating "service role only".
- The shape is deliberately the same as 0252's, so the two generations of Pitch Score tables give
  one answer about who may write, not two (A21).

### The detector was complete and reached by nothing

gate-or-promise: gate
- Already gated; `reachability:audit` refused it, which is A31 working as designed. The fix is the
  wiring — `readPatterns.ts`, the route, and the board — not an exception entry.
- Worth naming: the two documented exceptions in that audit (`budgetVarianceAlignment.ts`,
  `fetchJson.ts`) show what the alternative looks like a year later, and one of them is labelled
  "DEBT, not a decision. Nobody decided this should be unused." That is what an exception here
  would have become.

### The at-least-one-clean term is redundant under the current reading of "clean"

gate-or-promise: declined
- Declined deliberately. There is nothing to gate: the term is correct, matches the guide's
  wording, and changes no behaviour today. Removing it would make the code disagree with the
  specification for no gain; keeping it silently would imply it does work it does not.
- What exists instead is a control test that proves the redundancy by exhaustion and a comment
  naming the one reading under which it becomes load-bearing. If "clean" is ever redefined as
  "done right", that control fails and points at the rule.
- **The hole:** nothing forces the B4-adjacent question — whether a Partial counts as a miss, and
  whether a Partial can clear a pattern — to be answered. It is the founder's, it is on the record
  in two places now, and until it is answered a rep could in principle clear a pattern with five
  Partials without ever landing the point.
