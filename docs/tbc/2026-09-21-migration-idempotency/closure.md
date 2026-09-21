# CLOSURE — the list of landmines is empty

## What shipped

18 applied migrations edited in place to be safe-to-re-run, `NOT_RERUNNABLE_BASELINE` emptied, and
the gate re-proven with a planted probe. 254 migrations apply twice, cleanly, against Postgres 16.

## What this build got right, and it was not the code

Testing the founder's chosen option before building it. "A later migration cannot fix an earlier
one" is true, fast, and exactly the shape of answer §5 says to distrust. Two minutes of experiment
turned it into a result that could be handed back with the alternative already measured.

The second thing: reading the baseline's own justification as an argument rather than a fact. It
said the 18 were append-only because they had run in production — sound about the record, wrong
about the risk, and it had been sitting there being agreed with.

## The un-named reliance

- **That Supabase never re-runs an applied migration.** The entire safety case for editing rests on
  it. It is true of Supabase's migration tracking and it was not demonstrated here.
- **That the guarded statements are semantically identical.** `drop policy if exists` then
  `create policy` produces the same policy — unless the original had somehow been altered in
  production since, in which case the replay now silently restores the migration's version instead
  of failing. That is an improvement in every scenario I can construct and it is still a behaviour
  change nobody asked for.
- **That the regex transform read every statement correctly.** The diff was inspected file by file
  and every removal was a rewrite, but that is 18 files reviewed by eye, not a proof.
- **That `cascade` is contained by ordering.** True for a full replay, tested. The hand-run case is
  handled by a comment, which is prose, which A30 says returns.

## Residual

```json
[
  { "id": "R1-the-files-no-longer-match-what-production-ran",
    "item": "18 migrations are no longer a byte-exact record of the SQL production executed. The divergence is additive guards only, and each file is headed by the reason.",
    "why_skipped": "Not skipped — accepted, as the founder's decision, with the alternative (a permanent list of 18 unrepairable migrations) stated.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T22:30:00Z",
    "outcome": "OPENED because it ranks highest and A36 says read hardest there. It survives, but not for the reason it felt safe. The comfortable reading is 'the diff is only guards, so nothing changed'. The sharper one is that §3.1's append-only rule now has a precedent for being set aside by founder decision, and precedents are cited by the next person under pressure. What makes this one defensible is narrow and should be stated so it cannot be stretched: the edit is additive, mechanically verifiable, changes no resulting schema, and was proven necessary by disproving the non-editing alternative. A future edit to an applied migration that cannot make all four claims is not covered by this." },

  { "id": "R2-the-hand-run-cascade-hazard-is-guarded-by-prose",
    "item": "0135 and 0149 drop views with cascade. A full replay rebuilds the dependents; running one of those files alone drops views from 0136/0143/0146/0174/0175/0185/0182/0191 and does not restore them. The defence is a comment naming them.",
    "why_skipped": "No mechanical way to stop a human running one file by hand against a live database.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T22:31:00Z",
    "outcome": "OPENED. A30 says a lesson in prose returns, and this defence is prose. The mitigation is placement rather than form: the comment sits in the file at the drop, not in a doc, and the person who needs it is someone repairing a half-applied migration under pressure — the one moment they are certainly looking at that exact line. Worth being plain that this is the weakest guarantee in the build." },

  { "id": "R3-the-transform-was-reviewed-by-eye",
    "item": "A regex rewrote 90 statements across 18 files. The diff was inspected per file and every removal was a rewrite, but no property test asserts semantic equivalence.",
    "why_skipped": "The real check is the one that ran: 254 migrations applying twice with 0 failures exercises every rewritten statement against a real planner.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T22:32:00Z",
    "outcome": "OPENED. What the audit proves is that the statements EXECUTE, not that they produce the same objects — a guard that dropped and recreated a policy with a different USING clause would apply cleanly twice and be wrong. Nothing in this build compares the resulting schema to the pre-edit one. That comparison is buildable (dump both scratch databases and diff) and was not built." },

  { "id": "R4-the-CI-run-has-still-never-happened",
    "item": "migration:audit is wired into ci.yml with a postgres:16-alpine service and has never executed there.",
    "why_skipped": "Requires a push.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T22:33:00Z",
    "outcome": "OPENED, and it matters more after this build than before it. The baseline is empty, so CI is now the only place a regression in ANY of 254 migrations surfaces automatically. Before today a failure there would have been one of 18 known entries; now it is a real finding by construction." },

  { "id": "R5-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "Carried for the tenth build.",
    "why_skipped": "Rejected by the API; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T22:34:00Z",
    "outcome": "OPENED, unchanged, and untouched by this build. Ten builds is long enough that it should be re-sent in another format rather than carried again." }
]
```
