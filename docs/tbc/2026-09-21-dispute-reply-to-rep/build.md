# BUILD

## Files

**`src/lib/coach/pitchScore/readDisputes.ts`** — `replayDisputes(rows, opts)` extracted as a pure,
exported function. `readDisputes` now calls it rather than containing it. No behaviour change on
the manager side; its 17 tests pass unchanged, which is the point of doing the extraction first.

**`src/lib/coach/pitchScore/readPitchScore.ts`** — one more query in the existing `Promise.all`:
the pitch's dispute and answer events, through the **caller's** client, filtered by
`subject = pitch:<id>`. Replayed with `includeAnswered: true` — a rep must see answered threads,
which is the entire point — and returned as `disputes` on `StoredPitch`.

The ordering is load-bearing and easy to get wrong: `replayDisputes` needs answers **before**
disputes, and wants the disputes in the order the caller wants them out. So answers first, then
disputes reversed to newest-first. Both halves are mutation-tested.

**`src/components/sales-coach/PitchDetail.tsx`** — a "Your disputes" section directly above the
Dispute button, so a rep sees what happened to the last one before filing another.

Two states, both explicit:

- **Answered** — the manager's reply, beside the grade it is about.
- **Waiting** — *"Waiting on your manager. The score stays as it is until they respond."*

The waiting half is the one that would have been skipped. A dispute rendered with no status reads
as *nothing happened*, and a rep who concludes that once stops filing — which costs the scorer the
only correction signal it has. The second sentence exists because a rep who thinks their score is
provisional will not trust the leaderboard while they wait.

## What was NOT built

No new table, no new endpoint, no new event kind. The rep's view is the same log the manager's
queue reads, replayed with a different scope.

## Collateral

Adding a required field to `StoredPitch` broke three fixtures and one mock that did not know about
the new query — eight tests, all caught by running the folder rather than the file, and by
typecheck. Each was updated rather than made optional: a `disputes?:` would have let a caller
forget to pass it and silently render no threads.
