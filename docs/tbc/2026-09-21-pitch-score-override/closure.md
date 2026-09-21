# CLOSURE — a correction that moves the number, and a log the rep can read

## What shipped

A manager can correct one item on a scored pitch — an element grade, a bonus, or a violation —
with a required reason. The score recomputes through `scorePitch`, the same function that produced
it, and the correction is written to an append-only log the rep can read.

Four files, two migrations, 56 tests, 22 mutations.

## What this build got right, and it was not the code

The SQL version was written first and thrown away. It recomputed the totals in plpgsql, and it
would have worked — every number correct, on the day it was written. It duplicated six decisions
that already have authorities, and that is the defect class this session has now found five times
(the manager predicate, `lowestSectionId`, `bandFor`, the `pitches` table name, and this).

The thing that made it catchable was having a name for it. §2.2 is eight weeks old and was written
after an outage with exactly this shape; without it, "the database should compute the totals" is
just good sense.

## The un-named reliance

What this build leaned on without saying so at the time:

- **That `scorePitch` is deterministic.** The entire design rests on recomputing giving the same
  answer for unchanged inputs. It does — it is pure and takes no clock or randomness — but nothing
  asserts it, and a future rubric feature that reads `Date.now()` or a feature flag would break the
  override silently rather than loudly.
- **That the stored evidence is complete enough to re-score from.** `recomputeWithOverride` rebuilds
  the scorer's inputs from `pitch_score_elements` and `pitch_score_events`. If the scorer ever
  takes an input that is not persisted, an override would silently score the pitch as though that
  input were absent. Today the inputs are elements, bonuses, violations and two conversation facts,
  and all five are stored. That is a fact about today.
- **That `confidence: 1` on re-fed bonuses is safe.** It is correct *because* the scorer applied its
  floor when awarding them. That reasoning is in a comment and in one test; it is not enforceable,
  and it would be wrong the moment confidence is used for anything other than the award threshold.
- **That the founder's picker answer covers element grades.** The PDF says "any bonus or violation".
  Elements are a widening, chosen 2026-09-21. It is on the record here and in both migrations,
  because a future reader comparing the code to the PDF will otherwise find the code doing more
  than the spec.

## Residual

```json
[
  { "id": "R1-migration-audit-did-not-run-in-this-session",
    "item": "npm run migration:audit reported 'SKIPPED — no reachable Postgres'. 0255 and 0256 were verified against the full 254-migration history earlier today via MIGRATION_AUDIT_PSQL, but not in this session.",
    "why_skipped": "Believed unreachable: the gate reported 'SKIPPED — no reachable Postgres' at close.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T20:05:00Z",
    "outcome": "OPENED because it ranks highest, which per A36 is where to read hardest — and it did not survive the reading. It was RESOLVED, not carried. Reading it exposed that the premise was false: a healthy postgres:16 container was running the whole time, and the gate's skip banner was hiding 'FATAL: role postgres does not exist' inside a bare catch. With the right role the audit ran in this session — 254 applied, 0 failed, 18 known non-re-runnable, 0 new, exit 0 — so 0255 and 0256 are verified here rather than quoted from the morning. The premise that felt safest ('nothing has changed since the earlier run, so the earlier result stands') was the one worth attacking, and attacking it produced both a real verification and finding F3. What remains open is narrower and is now R8: the CI step has still never executed." },

  { "id": "R8-the-CI-migration-audit-step-has-never-executed",
    "item": "migration:audit is wired into ci.yml with a postgres:16-alpine service. It has run locally many times and never once in CI.",
    "why_skipped": "Requires a push.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T20:45:00Z",
    "outcome": "OPENED. The local runs now include a genuinely hostile one — a container whose role is not 'postgres' — which is closer to CI's shape than the happy path was. The remaining risk is the service health check and the PG* env wiring, and F3 makes that failure legible rather than a bare SKIP: CI will now print what psql actually said. Still 'it works locally', which is the claim A38 exists to distrust." },

  { "id": "R2-no-UI-so-the-dispute-queue-still-stalls",
    "item": "A manager cannot apply an override from anywhere. The API exists, is gated and is tested; no surface calls it. The dispute queue still ends at 'reply only' — the §1.5.1 layer-3 gap this build set out to close.",
    "why_skipped": "Ran out of build, not out of clarity. The API is the half that could not be added later without rework; the surface is the half that can.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T20:06:00Z",
    "outcome": "OPENED. This is the largest open item in the build and its confidence rating is the point: a feature that is complete at layer 2 and absent at layer 3 is not shipped. A manager reading a dispute they agree with is in exactly the position think.md describes — able only to type a reply — and the rep still learns that disputing is theatre. The build is half of a fix. It is named as half here rather than reported as done." },

  { "id": "R3-the-RPC-branches-are-untested-against-postgres",
    "item": "apply_pitch_score_override's upsert, its demote-not-delete path, its tenant raise and its empty-reason raise are covered by the caller's tests and by reasoning, not by SQL-level execution in this session.",
    "why_skipped": "No SQL test harness exists in this repo; migration:audit proves migrations APPLY, not that functions BEHAVE.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T20:07:00Z",
    "outcome": "OPENED. The most likely real defect is the `if not found` after the update of pitch_score_events: it is correct for a row that exists and correct for one that does not, but it treats 'updated zero rows because the values were already identical' the same as 'no such event' — Postgres reports FOUND on a no-op update, so this is fine, and that is a fact about plpgsql semantics I should state rather than assume. Named as untested; the gap is the whole function, not this line." },

  { "id": "R4-no-rep-has-seen-an-override-render",
    "item": "readPitchScore returns overrides and is unit-tested; PitchDetail does not render them.",
    "why_skipped": "Same boundary as R2 — the surface half of the build.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T20:08:00Z",
    "outcome": "OPENED and it is worse than R2 in one specific way: the rep-visible log is the SPECIFIED result (rubric p.7, 'with the change logged'), so per §1.5.4 it binds at layer 2, not layer 4. The data now travels to the component and stops there. This is the same shape as F1 one layer up — the read path exists, and nothing reads it." },

  { "id": "R5-the-2026-09-19-instruction-image-was-never-displayed",
    "item": "The image carrying the founder's 2026-09-19 coaching-upgrade instruction was rejected by the API and has never been opened. Resolutions B1 and B2 in LOGIC-AND-CONTRADICTIONS.md rest on a description that was inferred from surrounding text, not observed.",
    "why_skipped": "Not displayable by the agent; LAW 1 forbids describing it from anything but the render.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-21T20:09:00Z",
    "outcome": "OPENED, unchanged, and carried for the eighth build. Two decisions in a shipped document rest on an unread source. This does not touch the override build, which is specified by the PDF and the picker, but it remains the oldest unpaid debt in this workstream." },

  { "id": "R6-the-18-non-rerunnable-migrations-are-still-a-baseline",
    "item": "The founder chose 'one new migration that makes all 18 idempotent'. Not built.",
    "why_skipped": "It touches live RLS on 18 tables and is its own build with its own verification.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T20:10:00Z",
    "outcome": "OPENED. The decision is made and recorded; only the work is outstanding. Worth stating that the risk it addresses is not hypothetical — 0021 and 0022 both failed live on 'already exists' in June, which is why A12 exists." },

  { "id": "R7-the-milestone-and-rank-surfaces-still-collide-with-the-new-system",
    "item": "The milestone strip's 'First pitch' and 'Century' entries, and the rank surface, were mapped in TWO-SCORING-SYSTEMS.md as colliding with Pitch Score. Mapped, not resolved.",
    "why_skipped": "The map was the deliverable; resolving each collision is a founder call about what a rep sees.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T20:11:00Z",
    "outcome": "OPENED. One item in it is now more urgent than when it was written: the PDF (p.6) says Pitch Score IS the competition leaderboard, and the rank surface must therefore use competitionRanks — standard competition ranking, 1-2-2-4, corrected in the map before it shipped. Until that lands, two different orderings of the same reps can render in one product." }
]
```
