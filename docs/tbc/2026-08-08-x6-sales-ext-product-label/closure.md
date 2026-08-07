# CLOSURE — Sales Coach Extension: product label in the entitlement 402

## What shipped
The shared extension entitlement gate (`requireEntitledExtensionUser` / `guardExtensionRequest`) now takes an
optional `productLabel` (default "C.A.R.E extension"), and the four Sales Coach routes pass "Sales Coach
extension". A locked Sales Coach user now reads a 402 that names their product, not C.A.R.E.

## Un-named reliance (not self-evident)
- **The default is load-bearing.** `productLabel` defaults to "C.A.R.E extension" precisely so the 8 existing
  C.A.R.E callers are byte-for-byte unchanged. Do not remove the default or make the param required — that
  would silently change every C.A.R.E 402 string (and break the auth test's default case).
- **This fixes the LABEL, not the ENTITLEMENT SOURCE.** Whether the sales extension shares the C.A.R.E
  entitlement or gets its own SKU/trial is a founder pricing decision, deliberately NOT made here. The label
  is correct under either model because it names the caller's SURFACE, not the entitlement's origin. When the
  founder decides a separate sales entitlement, the gate wires a sales-specific `getExtensionEntitlement`
  variant — the label plumbing is already in place.
- **The entitlement object in the 402 body is still the C.A.R.E extension's** (shared source, today). That is
  honest as long as the sales extension shares that entitlement; revisit the body (not just the label) if the
  founder splits the SKU.

## Flagged, not fixed (§3.3)
- Entitlement SOURCE for the sales extension (share C.A.R.E's vs a separate sales trial/SKU) — founder
  pricing decision. → residual RES-01.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The sales extension's entitlement SOURCE is undecided — it currently reuses the C.A.R.E extension entitlement (getExtensionEntitlement).", "why_skipped": "Whether Sales Coach shares the C.A.R.E extension entitlement or gets its own SKU/trial is a founder pricing decision (part of the flagged pricing/entitlement work), not an engineering default I should guess. The product-label plumbing is now in place so either decision is a small wiring change.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T04:55:00Z", "outcome": "OPENED — founder decides share-vs-separate; if separate, add a sales getExtensionEntitlement variant + adjust the 402 body entitlement, reusing the productLabel already wired." }
]
```
