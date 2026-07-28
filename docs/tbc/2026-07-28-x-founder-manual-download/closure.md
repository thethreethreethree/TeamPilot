# CLOSURE — founder-only manual download

## 1. Session-read manifest

11 entries in think.md's manifest section, each with a this-session read_at.

## 2. Build inventory (reachability per A31)

| Feature | write/discover path | read path | status |
|---|---|---|---|
| Download route `/founder/files/buildmanual` | founder hits URL → requireVendorAdmin | PDF attachment (base64→bytes) | BUILT |
| Files page `/founder/files` | founder navigates (isVendorAdmin) | manual + download link; 404 for others | BUILT |

## 3. Verification record (A38)

```
> execos@0.1.0 check
> ... typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test
  invariant:audit — 690 files, 0 violations
> execos@0.1.0 tbc
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
> execos@0.1.0 test
      Tests  1602 passed | 15 skipped (1617)
EXIT=0
```

Coverage: all 7 gates (typecheck · lint · theme · rls · invariant · tbc[5] · test), exit 0.


Plus, before check: base64 round-trip → **374419 bytes, `%PDF` header, matches the original**;
`npx tsc --noEmit` on the new founder files → exit 0.

## 4. Findings ledger

No findings left open. The vendor-admin gate is the audited 0089 predicate, reused (not
reinvented). One follow-up recorded below.

## 5. Gates added

The founder-only access is enforced by `requireVendorAdmin()` (route) and `isVendorAdmin()` +
`notFound()` (page) — both fail closed and hide the file's existence from non-founders. No new
gate mechanism; the single audited predicate now guards one more surface.

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-28-FD-01",
    "item": "The PDF is embedded as base64 (~488 KB) in the route bundle rather than served from private storage.",
    "why_skipped": "Chose guaranteed-correctness (no fs/tracing, identical dev+prod) over elegance; felt certain the bundle cost doesn't matter for a founder-only rarely-hit route.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-28T16:00:00Z",
    "outcome": "OPENED. The ~488 KB lands only in this one route's serverless function (Next bundles per-route), which the founder hits rarely, so cold-start impact is negligible and no other route carries the weight. The alternative — a repo-file fs read — risked a production 500 under output:standalone (no file tracing), directly violating the founder's 'don't break' constraint. The clean long-term path is a private Supabase storage bucket + a signed URL gated by requireVendorAdmin (same pattern as care-rcd-media), which removes the bundle weight AND lets the PDF be updated without a code change. Recorded as a follow-up; not urgent. Trade-off confirmed correct for now."
  },
  {
    "id": "RES-2026-07-28-FD-02",
    "item": "End-to-end gate behaviour for the REAL founder account, live in production.",
    "why_skipped": "Requires a deployed session as the founder; the gate LOGIC is the audited 0089 predicate, confirmed by reading, but the live round-trip is a post-deploy check.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  }
]
```

Top residual opened per A36; opening it confirmed the base64 trade-off is the correct call under
the "don't break in production" constraint.

## 7. Hypothesis outcomes

- **H1** (reuse the audited vendor gate) — CONFIRMED; requireVendorAdmin used.
- **H2** (base64 round-trips exactly) — CONFIRMED; 374419 bytes, %PDF.
- **H3** (fs read would risk a prod 500; base64 is safe) — CONFIRMED enough; base64 chosen.
- **H4** (non-founders can't reach it or learn it exists) — BUILT; 403 (route) / 404 (page).

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
