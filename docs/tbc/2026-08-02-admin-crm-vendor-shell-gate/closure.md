# CLOSURE — vendor-CRM shell gate (/dashboard/admin/crm)

## What shipped
A server `layout.tsx` at `/dashboard/admin/crm/` gates the vendor-side CRM shell on the SAME vendor-admin
predicate the CRM API already enforces (`isVendorAdmin(ctx, getVendorCompanyId())`), `notFound()`-ing non-vendors.
Before this, the CRM pages were client shells with no server gate, so any company admin could render the
vendor-CRM shell — contradicting the CRM route's own stated posture ("don't confirm to a customer admin that a
vendor CRM exists"). The data was already 403-gated (0089); this closes the shell/existence exposure.

## Un-named reliance (not self-evident)
- **No data was ever exposed and none changes.** Every CRM route enforces `requireVendorAdmin`; this fix is about
  the SHELL/existence surface, not the data. Do not read it as patching a data leak.
- **The predicate is identical to the API's on purpose.** The layout reuses `isVendorAdmin` +
  `getVendorCompanyId` exactly as `requireVendorAdmin` does, so the shell decision and the data decision can
  never drift — a real vendor admin is never locked out of a page whose data they can load.
- **`notFound()` not `redirect()`, deliberately** — matches `/founder`'s posture: a customer admin guessing the
  URL learns nothing (a redirect to /dashboard would hint the path is special). Same identical-error reasoning as
  `requireVendorAdmin`.
- **Demo / unauthenticated → 404.** `isVendorAdmin(null,…)` is false, so no-auth requests 404 rather than
  throwing; the vendor CRM is not a demo surface (same as `/founder`).
- **A layout, not per-page.** One `layout.tsx` covers `crm/page.tsx` AND `crm/[id]/page.tsx` and any future crm
  child automatically — the safer shape than re-adding a gate per page.

## Flagged, not fixed (§3.3 — a decision, not a mechanical fix)
- The company-admin admin pages (`asset-readout`, `coach-readout`, `feedback`) are client shells whose DATA is
  `isAdmin`-gated (no leak) but which lack a layout-level redirect for non-admins. Adding one mirrors the care
  gate (clean redirect vs broken shell) but is a multi-page behavior change + a predicate choice → founder queue,
  green-light `"gate the admin dashboard shells"`.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No render-level test of the layout's notFound branch (server component); the gate predicate isVendorAdmin is unit-tested (vendorAuth.test.ts, 8 cases), the layout is a thin caller.", "why_skipped": "The security decision lives in the already-tested predicate; a Next server-component render harness for a thin notFound wrapper is high-cost, low-marginal-value — same posture as the /founder/files page (also predicate-gated, no render test).", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-02T03:53:11Z", "outcome": "OPENED — predicate carries the guard; layout mirrors /founder exactly." },
  { "id": "RES-02", "item": "The adjacent admin company-admin shells remain ungated at the layout level (broken shell vs clean redirect).", "why_skipped": "Data is isAdmin-gated (no leak); the redirect is a multi-page behavior change + predicate choice = a founder decision, flagged to the queue.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null }
]
```
