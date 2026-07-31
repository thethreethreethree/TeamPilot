# CHECK — verify:live §3.4 control-window trigger-wired guard

## Audit of the build

- **Only tightens:** a new independent check; can only ADD a failure (a dropped control-window trigger),
  never mask one.
- **Correct fn/table/bits:** matched to the ENUMERATED live trigger (`enforce_coach_control_window` on
  `companies`, BEFORE UPDATE, tgtype=19), not guessed.
- **Read-only:** catalog query, no mutation.
- **Scope owned:** §3.4 only; §3.5's durability enforcement (cron+trigger mix) deliberately deferred, not
  silently skipped (think.md §3).

## Findings

**No findings.** The guard passes on the healthy live DB and is detection-proven to flag a missing/renamed
control-window trigger. The deferral-reversal is owned on the record (think.md §2).

## Verification (canonical command + predicate detection test)

`npm run verify:live` — **all 20 invariants hold**, including the new §3.4 guard:

```
  ✓ PASS  §3.4 no-instant-results — the coach-control-window trigger is WIRED (Month-1 baseline can't be silently skipped)  — control-window trigger wired BEFORE UPDATE on companies
  ...
✅ ALL 20 invariants hold.
EXIT=0
```

Predicate detection test:

```
predicate (trigger runs enforce_coach_control_window on companies, fires UPDATE): ✓ WIRED (1)
detection (wrong fn): ✓ correctly 0
```

So the guard passes for the real wired trigger and returns 0 (→ the invariant FAILS) for a wrong fn — a
dropped/renamed control-window trigger is now caught in CI.
