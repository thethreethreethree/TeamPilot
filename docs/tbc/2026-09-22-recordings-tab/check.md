# CHECK — the Recordings tab

## The canonical gate

```
$ npm run check
```

`typecheck && lint && theme:audit && rls:audit && invariant:audit && reachability:audit &&
migration:audit && tbc && test`

Run at each stage below with its exit code read on its own line, never off the tail of a pipeline
(A38 — the mistake this session already made once and reported to the founder as a pass).

| Run | Result | What it caught |
|---|---|---|
| 1 | `CHECK_EXIT=1` | `rls:audit` — `recording_share_events` update/delete uncovered |
| 2 | `CHECK_EXIT=1` | `tbc:artifacts` — build/check/closure missing (correct; they did not exist) |
| 3 | see closure.md | — |

`reachability:audit` reported **Violations: 0** on run 2. Before the surface existed it correctly
reported `keyMoments.ts` exported and reached by no non-test file, and `recording_comments` named
nowhere in `src/`. Both were the A31 state and both were resolved by building the surface, not by
allowlisting.

## The migrations, against the live database

```
$ npm run db:dry
[db-apply] 3 pending migration(s): 0259, 0260, 0261

$ npm run db:apply
[db-apply] applying 0259_recording_comments.sql … ok
[db-apply] applying 0260_recording_share_events.sql … ok
[db-apply] applying 0261_notify_recording_events.sql … ok
[db-apply] applied 3 migration(s). DB now at 0261.
✅ ALL 30 invariants hold.
[db-apply] ✓ verify:live passed — structural invariants intact after the migration.

$ npm run db:dry
[db-apply] nothing pending — DB is up to date.
```

Applied through the ledger, never by hand — hand-applying is what produces off-ledger drift. The
second dry run is the idempotence check (§A12): re-running finds nothing pending.

`rls:audit` after 0260: **152 RLS-enabled tables, 0 without RLS, 0 tenant-pin risks, 0 missing
policies.** The two new allowlist entries carry their constitutional reason:

- `recording_share_events.update` — §3.1 append-only: the point of a log over a boolean is that a
  grant and a later revocation both survive.
- `recording_share_events.delete` — deleting a `declined` makes a rep who said no indistinguishable
  from one never asked, which is the state A10 forbids.

## Mutation testing

Not coverage. Each mutant is a change a careless future edit could plausibly make; a mutant that
survives is a finding until proven equivalent.

### `shareState` — the consent verdict (5 mutants)

| # | Mutation | Caught by |
|---|---|---|
| 1 | `shareable: kind === "granted"` → `kind !== "declined"` | 3 tests — a revocation would have become shareable |
| 2 | a `requested` row clears the prior answer | "a request after a GRANT does not silence a clip" |
| 3 | sort tie-break reversed | **SURVIVED — see below** |
| 4 | `askedSince` strict `>` → `>=` | "resolves a request and an answer sharing a timestamp" |
| 5 | no-answer status always `"none"` | "a request alone is pending" |

**Mutant 3 survived, and it was equivalent — so the code was deleted.**

The comparator broke ties toward the answer. Reversing it changed nothing, and the reason is
structural: the replay loop records the latest request and the latest answer *independently*, and
they meet only in `askedSince`, which compares their timestamps rather than their positions in the
array. The tie-break could not affect any output.

An inert line that reads like a safeguard is worse than no line, because the next reader will trust
it (A30 — a gate must be precise or not exist). It is gone, the sort is now `created_at` alone, and
the behaviour it was meant to produce is carried by the strict `>` that mutant 4 proves is
load-bearing. The test's comment was corrected too: it had claimed the tie-break was what made the
case pass, which the mutation showed to be false.

### `bucketPeaks` — the waveform (covered by 9 tests)

The two that matter: a silent buffer must normalise to zeros rather than dividing by a zero loudest
(NaN or a full-height bar per bucket, rendering silence as constant noise), and a single loud sample
in a hundred must survive bucketing, which a mean would erase.

### `keyMoments` / `timedLines` / `linesAround`

32 tests, 17 mutants, all caught after closing two real gaps — recorded in the earlier pass. The one
worth restating: `linesAround` must never *focus* an untimed line, only include it. Focusing one
points a manager at a quote with no claim to being at that moment.

## Tests

| Suite | Count |
|---|---|
| `keyMoments.test.ts` | 32 |
| `shareState.test.ts` | 11 |
| `peaks.test.ts` | 9 |
| `RecordingsTab.render.test.tsx` | 15 |
| **new this build** | **67** |

Full suite: **690 files, 5164 tests.**

## Two existing test files that failed, and why

Both were real signals, not flakes.

**1. `src/app/api/coach/sales-session/recordings/__tests__/route.test.ts` — 6 failures.**
I had overwritten the route it tests. This is the destructive-write incident recorded in build.md.
The route was restored from `HEAD` and mine moved to `pitch-recordings/`; the suite passes
untouched, which is the point — nothing about its expectations was negotiated.

**2. `src/components/sales-coach/__tests__/PitchScorePanel.render.test.tsx` — 5 failures.**
`PitchDetail` now renders `ManagerComments`, which issues a real fetch for guide item 6. The test's
mock answered calls strictly **in order**, so the new request silently consumed the response queued
for the panel's next call, and five assertions failed for a reason unrelated to what they assert.

Fixed by routing the mock **on the URL** rather than on call order, and by counting only the panel's
own calls in the one test that asserts a number. A queue keyed on call order couples every test in
the file to how many requests the whole subtree happens to make; keying on the URL couples them to
the panel, which is what they are about. No assertion about the panel's behaviour was weakened.

## Not opened

No image, icon or graphic asset was created, edited, moved or restyled during verification.
