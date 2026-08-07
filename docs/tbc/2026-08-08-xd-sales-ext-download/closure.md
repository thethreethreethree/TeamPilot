# CLOSURE — Sales Coach Extension: downloadable package + install page

## What shipped
The founder's request: the Sales Coach extension is now downloadable + installable from the Sales Coach page,
mirroring C.A.R.E. Completed the loadable package (content.js panel + adapters.js Tier-1 readers + placeholder
icons), added a deterministic prod-hardened build (`build-sales-extension-download.mjs` → `public/sales-coach-
extension.zip`, wired into prebuild), a sales `/extension/download-sales` install page, and a "Get the Sales
Coach browser extension" link on the Sales Coach dashboard (mobile + desktop). A client-wiring guard locks it.

## Un-named reliance (not self-evident)
- **The icons are C.A.R.E PLACEHOLDERS.** The manifest references icon16/48/128; without them Chrome won't
  load the package, so C.A.R.E's icons were copied in to make it loadable. Swap in a real Sales Coach icon
  before any public launch — the toolbar icon will otherwise be the C.A.R.E one. (Founder follow-up.)
- **The client RUNTIME is browser-unverified.** content.js (shadow DOM) + adapters.js (page selectors) are
  reasoned + statically-checked; confirm live per platform (PLATFORM-COVERAGE.md), same posture as C.A.R.E.
- **The zip is a committed, deterministic artifact.** `prebuild` regenerates it byte-identically, so committing
  it causes no churn; do not hand-edit the zip — edit `extension-sales/` and rebuild.
- **The manifest description was 142 chars — over the CWS 132 cap.** Shortened. The build validator enforces
  this; keep any future edit under 132.
- **Sign-in won't work until the connect page exists.** The panel's "Sign in" opens `/extension/connect`
  (with `product=sales`), which is NOT built yet. So a rep can DOWNLOAD + INSTALL now, but can't authenticate
  until the connect handoff lands. This is the one remaining gap to a fully-working extension.

## Flagged, not fixed (§3.3)
- A real Sales Coach ICON (not the C.A.R.E placeholder) — founder design follow-up.
- The `/extension/connect` handoff page (first-token Sign in) — buildable next (no entitlement dependency;
  delivers the Supabase token; the tool routes enforce entitlement).

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The /extension/connect handoff page (with product=sales support) is not built — the panel's Sign in has nowhere to get a token, so an installed extension can't authenticate yet.", "why_skipped": "It's the next server-ish piece (a page + token mint); buildable without the entitlement decision. Deferred to keep this download-feature commit coherent.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T06:30:00Z", "outcome": "OPENED — build /extension/connect (serve both extensions by product) next so Sign in works end-to-end." },
  { "id": "RES-02", "item": "Icons are C.A.R.E placeholders; the toolbar icon is the C.A.R.E logo.", "why_skipped": "Icon design is a founder call; a placeholder makes the package loadable now.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T06:30:00Z", "outcome": "OPENED — replace extension-sales/icons/* with a Sales Coach design before public launch." }
]
```
