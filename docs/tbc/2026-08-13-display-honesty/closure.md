# CLOSURE — two §3.4 display-honesty fixes

## What shipped
- **F1 (finance register):** the truncation disclosure survives a head-count read failure — `total: number | null`
  and `truncated = pageFull && (total === null || total > rows.length)`, so a full page always discloses (with the
  figure when known, "there may be older lines" when not), and exactly-1000 is not flagged. Closes the last edge in
  the xx finance-register disclosure.
- **F2 (after-pitch header):** the subtitle no longer calls an un-captured session a "conversation" — the label
  renders only when real audio or a captured transcript exists, so the header stops contradicting the "No
  conversation was captured" body (founder screenshot 2026-08-13).

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (finance routes RLS-scoped)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
test ✓ — Test Files 400 passed | 1 skipped (401); Tests 2759 passed | 15 skipped (2774)
EXITCODE=0
```
F1 route suite: `npx vitest run src/app/api/finance/bank/accounts/[id]/transactions` → 6 passed (2 new edges),
mutation-checked. F2 is React display (node-untestable, A30 honest).

## Residual (A36 — top OPENED)
```json
[
  { "id": "R1", "item": "F2 (the subtitle gate) and F1's UI null-branch copy are React, untested.", "why_skipped": "Standing node-env repo constraint; F1's load-bearing route logic IS tested (incl. the count-failure edge), and F2 gates an existing derived value with no new logic.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T10:10:00Z", "outcome": "Opened + assessed: accepted — the route logic is tested, the display gates are thin; the founder's device is the live check for F2." },
  { "id": "R2", "item": "The empty-session header now shows the context label instead of a duration — a rep gets NO time indication for a session that captured nothing.", "why_skipped": "Correct by §3.4: an un-captured session has no conversation length to honestly show; the wall-clock open-time is not a 'conversation'. If a neutral 'Xm Ys session' (not 'conversation') is wanted there, it's a small follow-up.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T10:11:00Z", "outcome": "Opened + assessed: intentional — better no time than a false 'conversation'. A neutral 'session' duration is an option if the founder wants one." }
]
```

## Un-named reliance
- F1 relies on `rows.length >= PAGE_MAX` as a sound "was capped" proxy (the route asks for exactly PAGE_MAX;
  PostgREST returns ≤ max_rows). F2 relies on `summary.hasSignal` / `audioDurationSeconds` being the true
  "something was captured" signals — confirmed by reading conversationDuration.ts + the summary state.

## Status
Complete; full gate exit 0 (pasted above). Commit the finance route/UI/test + the after-pitch page + this TBC dir
with explicit paths, then push.
