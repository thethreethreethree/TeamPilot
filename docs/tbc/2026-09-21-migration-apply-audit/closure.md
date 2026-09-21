# CLOSURE — the only prelude that can catch it

Yesterday's collision was found by asking a question about vocabulary. It should have been found
by a machine, in seconds, two days earlier — and the reason it was not is worth more than the
fix.

The migration had been verified against real Postgres. Twice. With a hand-written prelude
containing the tables it referenced. That prelude could not contain `pitches`, because nothing in
the new migration pointed at `pitches` — that was the entire bug.

Which makes this not a discipline problem. **Care makes it worse.** A prelude derived more
faithfully from the migration under test is a more complete guarantee that the migration will
pass. There is exactly one prelude nobody derived from the migration, and it is the real history.

So: 252 migrations, in order, against a plain Postgres 16 behind a small Supabase shim.

**Fresh apply: 0 failures**, with `pitches` and `pitch_scores` sitting on the same database —
the first real proof that yesterday's rename works against the actual history rather than
against something I wrote.

**Re-apply: 18 failures.** Every one a `create policy` or `create type` or `create index`
without a matching `drop … if exists`. That is A12 — *"migrations are safe-to-re-run by
construction"* — captured in June 2026 after 0021 and 0022 both failed live on "already exists".

A12's own capture note says the thing that matters here: *"the lesson had been documented in
0021's commit message but never absorbed as a personal authoring discipline before 0022 was
written."* Sixteen more non-re-runnable migrations have been written since. That is A30's claim
with three months of evidence behind it, and a gate is what a commit message could not be.

The two passes are graded differently on purpose. A migration that cannot apply is a deployment
blocker — fatal, no allowlist, no argument. Re-runnability is a real hazard and a historical one:
those 18 have run in production, they are append-only, and editing them now would rewrite history
to fix something already past. They are a named baseline, the gate fires only on a new one, and
the script reports when a baseline entry starts passing so the list can shrink instead of
calcifying into a permanent excuse.

Two portability bugs turned up, and both were found by trying to run the thing rather than by
reasoning about it.

It assumed a `postgres` database exists — true on a stock server and in CI, false on a container
whose `POSTGRES_DB` is something else, which is the machine I was on. The first run reported
**SKIPPED on a machine that had Postgres running the whole time**, which is the precise
false-negative this script exists to eliminate, produced by the script itself on its first
execution.

And it assumed psql on PATH. Most people run Postgres in Docker, where there is none, so the
verifier could not be executed at all on the machine that wrote it. Shipping it unrun would have
repeated this build's own subject: a verification never performed, reported as one.

The last detail is small and is the one I would keep. With no Postgres the script exits 0 and
prints, in those words, *"This is not a pass."* A developer without a database must not be
blocked; CI must not be able to believe a check ran when it did not. Saying which happened costs
one line and is the whole difference between a gate and a formality.

Proven the way A38 requires: the real collision reinstated, three migrations reported as unable
to apply, exit 1. Restored, exit 0. **This is the check that would have caught it in seconds.**

---

## Residual

```json
[
  { "id": "R1-the-CI-step-has-never-run",
    "item": "The workflow was edited to add a postgres:16-alpine service and the step that uses it. Structurally checked; never executed. The first real run is the next push.",
    "why_skipped": "Requires a push, and running GitHub Actions locally is its own setup.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:25:00Z",
    "outcome": "OPENED. The likely failure modes are the service health check and the PG* env wiring, and both fail LOUD — a red step, not a silent skip. The one that would be quiet is if the env vars are wrong in a way that makes the script report SKIPPED, which is why it prints 'This is not a pass' on that path: a reader of the CI log can tell the difference. That line was written for exactly this residual." },

  { "id": "R2-eighteen-migrations-are-still-not-re-runnable",
    "item": "Recorded as a baseline, not fixed. Each is a create without a matching drop-if-exists. If one ever half-applies live, it has to be repaired by hand — which is precisely how 0021 and 0022 were found in June.",
    "why_skipped": "They have run in production and are append-only. Editing them is a founder decision about rewriting applied history, not an implementation detail.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:26:00Z",
    "outcome": "OPENED and reserved for the founder per §6. Worth stating the shape of the safe version: not editing the 18, but a single new migration that drops-and-recreates those specific policies idempotently, leaving history intact and making the baseline shrink to zero. That is a real build with real risk — it touches live RLS — which is why it is named rather than attempted at the end of a long session." },

  { "id": "R3-the-shim-is-hand-written-and-can-drift",
    "item": "scripts/sql/supabase-shim.sql approximates what Supabase provides. Real Supabase could change auth.users, storage.buckets or the JWT helpers and the shim would not know.",
    "why_skipped": "The alternative is running the actual Supabase stack in CI — heavier, slower, and its own build.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T18:27:00Z",
    "outcome": "OPENED. It is the same class as the prelude that caused all this — a hand-written approximation of someone else's schema — which is uncomfortable and worth saying plainly. Three things make it different in degree: it is small, its contents are justified by a grep of what the migrations actually use rather than by what I assumed, and a gap fails LOUDLY. Four migrations failed on the first run because storage.buckets lacked file_size_limit, and that is the failure mode working rather than a flaw." },

  { "id": "R4-applying-is-not-behaving",
    "item": "This proves the schema can be CREATED. It exercises no RLS policy, no trigger, no RPC beyond creation, and no data.",
    "why_skipped": "A behavioural harness over 252 migrations is a different and much larger tool.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T18:28:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. It looks fine because rls:audit covers policy COVERAGE statically and the individual migrations were behaviour-verified by hand. The reason it may not be: those hand verifications used hand-built preludes, which is the flaw this whole build exists to remove — so the behavioural evidence for every one of them rests on the technique that was just proven unsound. The schema is now honestly verified; the behaviour is verified by a method with a known hole." },

  { "id": "R5-the-pitch-score-implementation-guide-is-still-not-in-the-tree",
    "item": "Carried unchanged for the twelfth build.",
    "why_skipped": "Not in the working tree and not obtainable by the agent.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T18:29:00Z",
    "outcome": "OPENED." }
]
```
