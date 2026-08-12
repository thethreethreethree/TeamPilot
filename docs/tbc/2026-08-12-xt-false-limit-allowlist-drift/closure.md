# CLOSURE — false-limit allowlist drift fix

## What shipped
Removed the stale `care/agent/analytics/route.ts` entry from INVARIANT 21's FALSE_LIMIT_ALLOWLIST (its
`.limit(5000)` was replaced by `fetchAllPaged` in build xr), restoring the guard on that route so a re-introduced
false limit can't slip through silently. Reworded the route's fix-history comment off the literal `.limit(NNNN)`
pattern so the restored guard doesn't false-positive on the comment. The 5 still-real founder-gated entries are
untouched.

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2744 passed | 15 skipped (2759)
EXITCODE=0
```

Detection test (A30): with a `.limit(5000)` probe re-added to the route, `invariant:audit` reported Violations: 1
on that file; probe reverted, back to 0. The guard is proven restored — not assumed.

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "INVARIANT 21 scans RAW file text (comments included), so any future comment that quotes a literal `.limit(NNNN)` will false-positive unless the file is allowlisted or the comment avoids the pattern.", "why_skipped": "Stripping comments from the scan is a larger change to a shared guard with its own regression risk (it would need to correctly handle strings/templates too); the convention 'don't quote a literal .limit(NNNN) in a comment' is cheap and this build follows it.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T12:40:00Z", "outcome": "Opened + assessed: accepted as a known property of the guard, documented here + embodied by rewording this route's comment. A comment-stripping pass is a reasonable future hardening of invariant-audit but out of scope for a drift fix." },
  { "id": "R2", "item": "The other 5 FALSE_LIMIT_ALLOWLIST entries are still allowlisted (finance register, admin coach-readout, brain learning-summary, care.ts, KPI cron).", "why_skipped": "Those false bounds are REAL and founder-gated ('fix the false limits' / the KPI-cron + finance decisions in the queue); removing their entries would either red the gate or force fixes the founder hasn't authorized.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T12:41:00Z", "outcome": "Opened + assessed: correctly retained — each still documents a live, tracked exception awaiting the founder's decision. Only the one genuinely-resolved entry was removed." }
]
```

## Un-named reliance
- Relies on the convention (now documented in R1) that fix-history comments don't quote a literal `.limit(NNNN)`,
  since the guard scans raw text.

## Status
Complete; the guard's restoration was proven by the detection test above (Violations: 1 on the probe, 0 after
revert). Commit with the TBC-Build trailer + explicit paths, then push.
