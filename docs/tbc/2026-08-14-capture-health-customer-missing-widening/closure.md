# CLOSURE — capture-health customer-missing widening

## What shipped
The manager-only capture-health card now counts the CUSTOMER-MISSING class (agent present, customer side absent
→ blank written read despite scores) as its own bucket + rate + per-agent breakdown. This was the incident's
blind spot: the metric only counted zero-agent-turn sessions, so the founder-reported customer-missing session
was invisible to it. Additive — existing counts unchanged.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓ · invariant:audit ✓ (Violations 0)
tbc ✓ — docs · manifest · artifacts · residual · freshness
Test Files 411 passed | 1 skipped (412); Tests 2850 passed | 15 skipped (2865)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "customerMissing reflects the CURRENT transcript state — once auto-recover adds the customer side, the session drops out of the count.", "why_skipped": "It shows the currently-unrecovered backlog, which is the actionable number. An 'ever customer-missing' count would need an event/marker; not warranted for a v1 visibility metric.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T02:05:00Z", "outcome": "Accepted; documented in the think.md interconnections section." },
  { "id": "R2", "item": "A session whose customer side is only in `unknown` segments (never labeled customer) counts as customer-missing.", "why_skipped": "Correct by design — that IS the talk_ratio caveat condition (custW===0), and re-transcribe is exactly the fix; it matches the auto-recover trigger.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T02:05:30Z", "outcome": "By design." }
]
```

## Un-named reliance
- Relies on "an agent segment ⟺ scores compute ⟺ the session is out of the 0-agent noFeedback population", the
  same MIN_AGENT_SEGMENTS equivalence the rest of the after-pitch pipeline uses. If that threshold changed, the
  disjointness of customerMissing vs noFeedback would need to follow it.

## Status
Complete once the gate shows exit 0. The metric is no longer blind to the customer-missing capture class.
