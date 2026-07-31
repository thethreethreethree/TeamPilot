# CHECK — verify:live §3.5 durability-emit trigger-wired guard

## Audit of the build

- **Only tightens:** independent new check; can only ADD a failure (a dropped durability trigger).
- **Correct fn/table/bit:** matched to the enumerated live trigger (`resolutions_emit_durability_review` on
  `resolutions`, UPDATE), not guessed.
- **Read-only:** catalog query.
- **Completes the class:** §3-thesis trigger-wiring is now §3.1+§3.2+§3.4+§3.5 (closure).

## Findings

**No findings.** Passes on the healthy DB; detection-proven to flag a missing/renamed durability trigger.

## Verification (canonical command + detection test)

`npm run verify:live` — **all 21 invariants hold**, including the new §3.5 guard:

```
  ✓ PASS  §3.5 durability loop — the durability-review EMIT trigger is WIRED (a resolved-then-reviewed signal reaches the event chain)  — durability-review emit trigger wired on UPDATE of resolutions
  ...
✅ ALL 21 invariants hold.
EXIT=0
```

Predicate detection test:

```
§3.5 emit-trigger WIRED: ✓ (1)   detection(wrong fn): ✓ 0
```

Passes for the real wired trigger; returns 0 (→ FAIL) for a wrong fn — a dropped durability trigger is caught.
