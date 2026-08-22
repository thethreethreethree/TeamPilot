# CHECK — DoorLog residuals: keepalive + reject empty storagePath (audit M2 + M3)

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  559 passed | 1 skipped (560)
      Tests  3682 passed | 15 skipped (3697)
EXIT: 0
```

(Targeted: DoorLogChunkedSave.render 2 pass. One earlier full run showed 4 load-sensitive guard-test flakes
[no-methodology-citations / adminRoleSingleSource / envDocsComplete / authRedirectCanonical] — all pass standalone
5/5 and green in the clean run above; unrelated to this change, which touches only DoorLog fetch + the pitch schema.)

## What the tests prove
- **M2:** every door-log POST (knock + pitch) is issued with `keepalive: true` — captured from the fetch `init`.
  So a save in flight survives the rep leaving. The existing chunked-save assertions still pass.
- **M3:** covered by the schema (`z.string().min(1)`) + the route's existing branch that 400s an empty/absent
  storagePath. Testing the zod predicate itself is low-value (the schema isn't exported); the behavioral
  guarantee — a pitch with no usable audio ref → 400, not a doomed record — is the route's existing "A pitch
  requires audio" path, now belt-and-suspendered at the boundary.

## Honest limit
The unload-survival of `keepalive` can't be exercised in jsdom (no real page lifecycle); the test asserts the
FLAG is set, which is the mechanism the browser honors. The single-blob fallback upload remains non-keepalive
(>64KB) — residual below.

## Findings
**No findings.** No data/schema change; keepalive is additive; M1 confirmed already mitigated by the chunked
live-upload path.
