# CHECK - keep voices apart

## Commands

```
$ MIGRATION_AUDIT_PSQL=... npm run migration:audit
  Migrations applied: 268   RLS probes: 3 run, 0 failed   (probe 0270: all assertions hold)
$ npx tsc --noEmit -p .                                    exit 0
$ npx vitest run (attribute-unlabelled, src/lib/coach/v5, src/lib/data, src/app/api/coach/sales-session)
 Test Files  219 passed | 1 skipped (220)
      Tests  1522 passed | 15 skipped (1537)
$ (mutation: recovery drops speakerId)    transcriptRecovery.voices.test.ts   Tests 2 failed   (restored)
$ (app) npx tsc --noEmit 0 · npm test pass 1592 fail 0 · npm run lint 0 · node ../tools/gate.mjs 0
$ (app, mutation: a multi-voice pick sends { mine: true })   npm test   fail 1   (restored)
```

The full `npm run check` is appended below.

## Findings

### An undecided two-voice recovery could only be answered as one voice

class: per-party attribution dropped at a save boundary (A39)
sweep: every writer of 'unknown' segments from a diarized read: transcriptRecovery, upload-recording unattributed save, label-transcript (labels on the spot, keeps nothing to ask)
severity: high

### The route and the app both documented "unknown means one voice"

class: a comment asserting an invariant the code does not hold
sweep: grep -rn "one voice\|by construction" in the route, relabel-unknown.ts, [id].tsx; all three corrected
severity: medium

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (two runs)

```
$ MIGRATION_AUDIT_PSQL=... PGPORT=55433 ... npm run check
run 1: exit 1   the local postgres container had stopped; migration:audit SKIPPED ("This is not a pass")
run 2: exit 0   (container restarted)   RLS probes: 3 run, 0 failed
 Test Files  733 passed | 1 skipped (734)
      Tests  5699 passed | 15 skipped (5714)
```

## Appended 2026-10-08T14:05Z - the card render-tested

```
$ npx vitest run src/components/sales-coach/__tests__/BlankReadRecovery.render.test.tsx   Tests 3 passed
$ (mutation: the two-voice branch disabled)   Tests 2 failed | 1 passed   (restored)
```

```
$ npm run check   (with the card moved and render-tested; run 1 failed typecheck on an index that may be undefined in the new test, fixed)
 RLS probes: 3 run, 0 failed
 Test Files  734 passed | 1 skipped (735)
      Tests  5702 passed | 15 skipped (5717)
exit 0
```

## Appended 2026-10-08T16:30Z - a sales-call question, only on sales calls

### "Whose voice is the rep?" was offered and accepted on meetings and huddles

class: a sales-only action with no session-kind check (scoring already refuses: scoreSession not_a_sales_call)
sweep: grep -n "sessionKind\|session_kind" on the attribute route, generateSessionArtifacts, the app's question path: none checked it
severity: medium

Production: 6 meetings, all recovered; 5 have all-'unknown' transcripts, which the app lists and would ask about.
"That's me" would have labelled every participant the rep and run the sales engines on a meeting.

```
$ npx vitest run attribute-unlabelled                      Tests 25 passed
$ (mutation: the kind check never fires)  -t "not a sales call"   Tests 2 failed   (restored)
$ (app) tsc 0 · npm test pass 1593 fail 0 · lint 0 · tools/gate.mjs 0
$ (app, mutation: sessionKind ignored)   npm test   fail 1   (restored)
```
One run during the mutation check reported "68 failed, no tests" with no assertion: the local runner flake
(docs/tbc/2026-09-30-coached-calls R2), not a result; rerun gave the real one above.

```
$ npm run check   (with the sales-only rule)
 RLS probes: 3 run, 0 failed
 Test Files  734 passed | 1 skipped (735)
      Tests  5704 passed | 15 skipped (5719)
exit 0
```
