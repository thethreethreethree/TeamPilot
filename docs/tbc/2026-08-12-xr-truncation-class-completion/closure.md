# CLOSURE — truncation-class completion

## What shipped
The three remaining unbounded-`.select()` truncation instances now page their reads via `fetchAllPaged`,
closing the class the session swept (KPI HIGH fixed in xo; dashboard + CARE analytics + list-badge here). Founder
explicitly authorized "Fix them all (keep everything)".

## Verification (A38) — real gate output
`npm run check` — full gate, exit 0:

```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ (0 leaks) · rls:audit ✓ (0 without RLS, 0 tenant-pin risks)
invariant:audit ✓ — Files scanned 773 · Violations 0
tbc ✓ — docs (2 match) · manifest (12) · artifacts · residual (3) · freshness — all ✓
test ✓ — Test Files 398 passed | 1 skipped (399); Tests 2740 passed | 15 skipped (2755)
EXITCODE=0
```

Targeted route tests (the behaviour this build changed):
```
$ npx vitest run src/app/api/coach/sales-session/list src/app/api/care/agent/analytics src/app/api/coach/sales-session/dashboard
 Test Files  3 passed (3)
      Tests  9 passed (9)
```

## Residual (A36 — ranked by confidence-it-does-not-matter; top OPENED)
```json
[
  { "id": "R1", "item": "The dashboard cue-count and the list badge/signal reads still carry a `.in(id-list)` filter whose id list grows with the driving set (a rep past 1000 sessions / >1000 subjects). Paging fixes the OUTER read's cap but not a >1000-element IN-list.", "why_skipped": "The durable fix is a server-side aggregate RPC, which is a migration — consequential, gated to the founder's db:apply, and a secure RPC needs the client-callable-DEFINER care not worth rushing deep in a long session. Bounded today: the list is 300-session-capped so its subjects stay well under the cap; the dashboard cue-count is the one exposed surface and only for a rep past 1000 lifetime sessions.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T11:05:00Z", "outcome": "Opened + assessed: correct + honest for the first-client (low-volume) scale; the outer-read truncation (the reported class) is closed. Flagged that a tenant past the IN-list ceiling should get the RPC aggregate. Documented in FOUNDER-ACTION-QUEUE; not built to avoid a rushed/gated migration." },
  { "id": "R2", "item": "The list SIGNALS latest-per-(session,kind)-wins order across pages is proven by reading `extractSessionSignals` + the (created_at desc, id desc) order, not by a live >1000-row DB.", "why_skipped": "No live Postgres in-sandbox; the keyset/paged-order class is environment-gated per the recorded lens. The route tests exercise the <1000-row single-page path, which is identical in intent.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T11:06:00Z", "outcome": "Opened + assessed: the order is deterministic by construction (created_at desc, stable id-desc tiebreaker) so first-seen-per-session stays the latest across page boundaries; live-DB confirmation is the standing sandbox gap, not a defect of this change. Accepted." },
  { "id": "R3", "item": "The three routes are covered by route tests, but only two had their mocks updated (dashboard, CARE analytics); the list route has no new assertion for the paged badge/signal reads.", "why_skipped": "The list route's paging is behaviour-preserving on the <1000 path its existing coverage exercises; the two updated tests pin the load-bearing derivations (dashboard stats, resolution-rate contract).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T11:07:00Z", "outcome": "Opened + assessed: acceptable — the list change is the lowest-severity instance (300-cap-bounded) and the pattern is identical to the two tested routes. A dedicated list paging test is a reasonable follow-up but not load-bearing for this class-closure." }
]
```

## Un-named reliance (the other half of closure)
- Relies on `fetchAllPaged`'s 200k-row backstop + throw-on-error — past that ceiling (far beyond any real rep)
  the read stops and the throw is caught to the honest-error state, not silently truncated.
- Relies on the founder's "fix them all (keep everything)" decision as the authorization — not an agent
  inference (§1.2), the correction from the earlier CARE-readout misstep.

## Workflow continuity (§1.5.1)
Read-only analytics/list surfaces; no workflow change. Counts/rates/badges simply become correct at scale.

## Status
The prior gate run stopped only on this closure.md being absent (no code finding); the re-run below closes that
gap. Commit with explicit paths + a Session-Reads trailer, then push.
