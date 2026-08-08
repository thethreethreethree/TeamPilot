# CLOSURE — entitlement-gating drift guard

## What shipped
A source-level drift guard asserting every built `coach/extension` tool route is entitlement-gated (calls
`guardExtensionRequest`) or is explicitly `UNGATED_BY_DESIGN` (`refresh`). The invariant confirmed this session
by reading every route (all 5 tools gate server-side) is now a CI gate that fails on the next ungated route.
Test-only; no route or behavior change. Detection-proven: `refresh` lacks the guard string, so the exemption is
load-bearing.

## Un-named-reliance check
The guard is a SOURCE-STRING check (`route.ts` contains `guardExtensionRequest`). It relies on the gate being
invoked via that named helper. If a future route inlined the auth/entitlement logic under a different name, the
guard would false-NEGATIVE (flag a route as ungated when it's actually gated a different way). That reliance is
named: the guard enforces the CONVENTION (route through the shared helper), which is itself the right design
(A21 — one implementation, not per-route forks). A route that forks the logic should fail this guard and be
pushed back onto the shared helper — so the false-negative is actually the desired signal, not a blind spot.

## Residuals
```json
[
  {
    "id": "R1-string-match-not-callgraph",
    "item": "The guard matches the string `guardExtensionRequest`, not a real call-graph — a route that imports it but never calls it, or calls it after doing work, would still pass.",
    "why_skipped": "A full call-graph/AST check is far heavier than the risk warrants; the realistic regression is 'new route forgets the gate entirely' (no import, no call), which the string check catches. The subtler 'imports but misuses' is caught by the route's own 402 behavioral test.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-08T03:30:00Z",
    "outcome": "OPENED and resolved: the two failure modes are covered by two different guards — this drift guard catches the total-omission case (the common regression), and the per-route 402 test catches the misuse case (guard called but bypassed). Neither alone is complete; together they cover the realistic space. A string match is the right weight for the omission case; escalating to AST would be gold-plating (A24-adjacent). No action."
  }
]
```
