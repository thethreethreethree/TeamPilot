# CLOSURE — self-cleaning FALSE_LIMIT allowlist

## What shipped
INVARIANT 21's FALSE_LIMIT_ALLOWLIST is now self-cleaning: an entry whose file no longer contains a live
`.limit(N>1000)` is flagged STALE (and trips the audit's own self-test), so the xt drift — a fixed file left
silently allowlisted — self-reports next time instead of waiting for a manual re-audit. CI-guard hygiene only; no
product/runtime change. Scoped to the FALSE_LIMIT allowlist (the other ~15 are out of scope, stated in build.md).

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0 (self-tests pass)
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2744 passed | 15 skipped (2759)
EXITCODE=0
```

Detection test (A30): a probe entry allowlisting a no-false-limit file (list route, `.limit(300)`) made
`invariant:audit` exit 3 (self-test failure) + would surface a stale-entry finding; probe reverted → Violations: 0,
exit 0. The guard is proven to bite in both directions.

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "Only the FALSE_LIMIT allowlist self-cleans; the other ~15 allowlists in invariant-audit.mjs have no live-entry self-check.", "why_skipped": "Each suppresses a different pattern with different detection logic, so a generic 'every allowlist entry is still live' check is a separate, larger design (and I verified all 21 allowlisted PATHS currently exist, so no dead-file drift today).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T13:05:00Z", "outcome": "Opened + assessed: scoped deliberately to where the drift actually occurred (FALSE_LIMIT). A general allowlist-liveness meta-check is a reasonable future build but was not silently smuggled into a targeted fix. Paths-exist check run manually (clean); could be a small future guard." },
  { "id": "R2", "item": "The self-check inherits the raw-text-scan property: a file whose only .limit(N>1000) is inside a COMMENT reads as 'live', so a stale entry could hide behind a fix-history comment.", "why_skipped": "Same documented property as INVARIANT 21 itself; the convention (keep fix-history comments off the literal .limit(NNNN) pattern, as build xt did) covers it, and comment-stripping the scan is a larger shared-guard change.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T13:06:00Z", "outcome": "Opened + assessed: accepted as a known, documented property; the convention is cheap and this build follows it." }
]
```

## Un-named reliance
- Relies on the convention that fix-history comments don't quote a literal `.limit(NNNN)` (the guard scans raw
  text) — same as INVARIANT 21.

## Status
Complete + detection-tested (exit 3 on a stale probe, exit 0 clean). Commit with the TBC-Build trailer + explicit
paths, then push.
