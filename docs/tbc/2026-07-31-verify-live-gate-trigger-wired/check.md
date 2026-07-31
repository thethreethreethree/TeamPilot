# CHECK — verify:live §3.2 trigger-wired assertion

## Audit of the build

- **Only tightens, never loosens:** the change ANDs a new condition into an existing pass predicate, so
  it can only make a previously-passing check FAIL when the trigger is un-wired — it can never mask a
  regression. Safe direction.
- **Precise, not broad:** it matches the specific fn (`check_understanding_gate`) on the specific table
  (`problems`) with the specific event bits (BEFORE INSERT+UPDATE) — so it catches the exact bypass
  (trigger dropped, or narrowed to UPDATE-only letting a direct INSERT through), not a vague "some
  trigger exists".
- **Read-only:** a catalog query; no mutation, no side effect.

## Findings

**No findings.** The strengthened check passes on the healthy live DB and is detection-proven to fail on
the bypass scenario.

## Verification (canonical command + detection test)

`npm run verify:live` — **all 18 invariants hold**, including the strengthened §3.2 line:

```
  ✓ PASS  §3.2 understanding gate (raises + '*' threshold + trigger WIRED before insert-or-update)
  ...
✅ ALL 18 invariants hold.
EXIT=0
```

Detection test of the trigger-wired query against the live DB (proves it discriminates):

```
REAL check (BEFORE INSERT+UPDATE wired): ✓ passes (returns 1)
DETECTION (demand DELETE bit the trigger lacks): ✓ correctly returns 0 (bitmask discriminates)
DETECTION (wrong fn name): ✓ correctly returns 0
```

So the check passes for the real wired trigger, and returns 0 (→ the invariant FAILS) if a required
event bit is missing or the function is wrong — the un-wired / narrowed-trigger bypass is now caught.
