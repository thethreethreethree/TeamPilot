# CHECK — founder-only download audit

Audited the built files: the route, the embedded data module, and the Files page.

## Within-module pass (four layers)

- **1 structure:** two small surfaces sharing one audited predicate; PDF embedded so serving is
  deployment-agnostic. Sound.
- **2 effectivity:** the founder gets the exact PDF (base64 → 374419 bytes, %PDF); a non-founder
  gets 403 (route) / 404 (page). Confirmed.
- **3 composition:** founder → `/founder/files` → click → file. Complete flow, no dead end. A
  customer who guesses the URL learns nothing (identical error / not-found).
- **4 surface:** on-brand page; the button says exactly what it does ("Download PDF").

## Cross-module pass (A21)

"Who is the founder/vendor" now has one behaviour across surfaces: the CRM back-office
(`/api/admin/crm/*` via `requireVendorAdmin`) and this new `/founder/files*` both key on the same
`isVendorAdmin(ctx, vendorCompanyId)` predicate. No second, divergent "founder" definition was
introduced — which was the exact risk (a home-grown email check would drift from the CRM gate).

## Class sweep (A26)

- class: a vendor/founder-only surface gated by anything OTHER than the single vendor-admin
  predicate (the 0089 CRITICAL was exactly this — the CRM gated on own-company `isAdmin`).
- sweep: `grep -rnE "requireVendorAdmin|isVendorAdmin|getVendorCompanyId" src` (the sanctioned
  gate) and `find src/app/founder src/app/**/admin` for vendor surfaces. Result: the CRM routes and
  these two new `/founder` surfaces are the vendor-only surfaces, and all use the single predicate.
  No ungated vendor surface introduced.
- leak-path check: the base64 lives only in a server module imported by the gated route; the page
  does not embed it. There is no route to the bytes that bypasses `requireVendorAdmin`.

## Findings

No findings left open. One follow-up recorded as residual (embed → private storage).

## Gate-or-promise

The founder gate is structural, not prose: both surfaces call the ONE audited predicate that
fails closed, so a future `/founder/*` surface that forgets it would be the visible anomaly, not a
silent copy of a subtly-different rule.

## Inspected / not-inspected

- **Inspected:** vendorAuth.ts (the gate), both new surfaces, the base64 round-trip, next.config
  headers (apply to /founder), the absence of middleware that could interfere.
- **NOT inspected (→ residual):** live production behaviour of the gate for the real founder
  account (requires a deployed session) — the logic is the audited 0089 gate, but the end-to-end
  prod check is a post-deploy step.
