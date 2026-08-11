# CLOSURE — Customer upload honest-partial (502 on failed attachment post)

## What shipped
The customer upload finalize tail (`attachCustomerFile`) now checks `postCustomerMessage`'s result and returns
502 with the file row (recoverable) when the inline attachment message fails to post — mirroring the agent
tail — instead of the prior silent 200. Closes the §3.4 dishonest-partial + A16 apply-here-miss-there
asymmetry the F2 adversarial review surfaced. A test locks the 502-on-null path.

## Un-named reliances (A35 — name them)
- **`postCustomerMessage` returns `null` on failure and logs the cause.** The 502 decision depends on that
  contract (`src/lib/data/care.ts` — returns `SupportMessage | null`, logs on the `null` branch). If it were
  changed to throw instead of return null, this check would miss — but the surrounding code has no try/catch,
  so a throw would surface as a 500, still not a false 200.
- **The widget treats any `!res.ok` as an error and does not refresh the thread.** True today; the 502 relies
  on it to show the retry rather than a false success.

## Residual (A36 — ranked by confidence-it-does-not-matter; top must be OPENED)
```json
[
  { "id": "R1", "item": "The 502 retry path re-uploads and creates a second file row (no resume of the half-attached upload).", "why_skipped": "Identical to the agent tail's retry behavior; the file row is recoverable from the library, and a resume mechanism is more complexity than an internal, rare failure warrants.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T17:19:00Z", "outcome": "Confirmed the agent tail has the exact same re-upload-on-retry property (it returns 502 with the row and the client re-posts). Matching it is the correct consistency choice; a dedup/resume would be a separate, broader change across BOTH tails, not this fix. No action." },
  { "id": "R2", "item": "Other data-layer writes in the tail (emitAssetEvent) are still unchecked best-effort.", "why_skipped": "emitAssetEvent is a §3.1 chain event; a failed emit does not make the user-visible attachment wrong (the message posted, the file is attached). Left best-effort, consistent with the agent tail.", "confidence_it_does_not_matter": "medium", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations: 0
tbc ✓ — docs · manifest (11) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 388 passed | 1 skipped (389); Tests 2678 passed | 15 skipped (2693)
CHECK_EXIT=0
```
