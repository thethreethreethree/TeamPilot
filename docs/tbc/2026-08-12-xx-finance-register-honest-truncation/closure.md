# CLOSURE — finance register honest truncation

## What shipped
The bank register now caps honestly at max_rows (1000, replacing the false `.limit(2000)`), head-counts the true
total when the page is full, and DISCLOSES truncation in the UI — "Showing the most recent 1,000 of N
transactions — older lines aren't listed here yet." The rows shown are unchanged; only the hidden history is now
made visible (§3.4, the assetReadout `bounded` pattern). Removing the >1000 bound emptied the finance
FALSE_LIMIT_ALLOWLIST entry (the xu self-cleaning check required it), leaving care.ts (the c5fbd454 KEEP/REVERT) as
the SOLE remaining false-limit exception. Full pagination (load-older) stays the founder-gated UX enhancement.

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (finance routes RLS-scoped; 0 without RLS)
invariant:audit ✓ — Files scanned 773 · Violations 0 (FALSE_LIMIT self-cleaning check + self-tests pass)
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2744 passed | 15 skipped (2759)
EXITCODE=0
```

No unit test exists for the register route or the banking page (stated in check.md — no test claimed that was not
written); the false-bound removal is confirmed by the FALSE_LIMIT invariant + its self-cleaning check.

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "The register still cannot SHOW transactions older than the most recent 1,000 — it only discloses that they exist.", "why_skipped": "Full retrieval is a load-older / paginated register UI, which is a genuine UX decision (load-more button vs infinite scroll vs date-range filter) on a live finance surface — the founder's call, offered in the queue as 'paginate the finance register'. Disclosure is the honest stopgap.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-12T14:40:00Z", "outcome": "Opened + assessed: intentionally scoped to disclosure. The user now KNOWS history is hidden (no longer a silent lie); retrieving it is the founder-gated next build." },
  { "id": "R2", "item": "No unit test for the route's head-count/truncated logic or the UI notice.", "why_skipped": "The route is a thin RLS read + a head count; the page is React (no jsdom harness in this repo). The logic is simple + typecheck-covered, and the invariant confirms the false bound is gone.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T14:41:00Z", "outcome": "CLOSED (follow-up, same session): added a route test (route.test.ts, 4 cases) pinning the truncation logic — under-cap → truncated:false + NO head-count query paid for; at-cap+more → truncated:true + total = the exact head count; the 401 gate; a read error → honest empty shape (no leak). Mutation-checked: forcing `truncated:false` fails the at-cap case with the expected diff, then reverted. The UI notice (React) remains untested per the standing repo constraint." }
]
```

## Un-named reliance
- Relies on the head count (`count: exact`) being cheap enough at register scale — it runs only when the page is
  full (≥1000 rows) and is a head count (no rows returned), so it is a single indexed count, not a scan of rows.

## Status
Complete; full gate exit 0 (pasted above). Commit with the TBC-Build trailer + explicit paths, then push.
