# CLOSURE — Sales Coach Extension, Phase 2b-worker: the service worker

## What shipped
`extension-sales/background.js` — the MV3 service worker, ported from the C.A.R.E worker and adapted for
sales (sales message types + token keys, coach endpoint allowlist, refresh via the shared coach route, RCD/
image handlers dropped), plus a static port-completeness + allowlist guard test. Everything statically
checkable is checked; the Chrome-API runtime is labeled unverified and confirmed live by the founder.

## Un-named reliance (not self-evident)
- **This build CORRECTS an earlier over-conservative stance.** I had deferred the whole client as
  "unverifiable." The project's own C.A.R.E client (in-repo, labeled unverified, founder-confirmed) shows the
  honest rule is "don't CLAIM it works," not "don't write it." Building labeled browser code IS the pattern.
  Do not re-defer the remaining client pieces on the "unverifiable" grounds — write them, label them, let the
  founder confirm live.
- **The worker is NOT a loadable extension.** It is one piece. Without content.js (panel), adapters.js, the
  connect page, and icons, nothing loads. check.md names all four; do not imply the extension works from the
  worker's presence.
- **The refresh is REUSED, not re-implemented.** `salesFetch` calls `/api/coach/extension/refresh` (which
  shares `refreshExtensionSession` with the C.A.R.E route). Do not inline a Supabase refresh here.
- **The endpoint allowlist is a security boundary, not a nicety.** `ALLOWED_ENDPOINT` stops the worker being
  turned into an open proxy. The guard test exercises the REAL regex against traversal/cross-host — keep it
  tight (`/api/coach/extension/[a-z]+` only) if a future tool is added.
- **The connect page can be built WITHOUT the entitlement decision.** It just delivers the Supabase token;
  entitlement is enforced at the tool routes. So the remaining client work is NOT blocked by the pricing
  decision — only the entitlement's 402 behavior is.

## Flagged, not fixed (§3.3)
- content.js (panel), adapters.js (Tier-1 platforms), the sales `/extension/connect` page, and icons remain —
  the rest of the loadable client. Sequenced in check.md + the README, recorded in project memory.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "content.js (the panel) is not built — nothing renders the tool results yet.", "why_skipped": "One piece per unit; the panel is the next port. It is browser-unverifiable (DOM/shadow-root) and will ship labeled + founder-confirmed, same as the worker.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T06:18:00Z", "outcome": "OPENED — port content.js next (render SALES_TOOLS; the coach/formulate input boxes; post sales-tool)." },
  { "id": "RES-02", "item": "adapters.js (per-site readers), the /extension/connect page, and icons remain.", "why_skipped": "adapters + connect + icons are the rest of the loadable client; adapters are unverifiable-live (per PLATFORM-COVERAGE.md Tier 1 first), the connect page is buildable now (no entitlement dependency).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T06:18:00Z", "outcome": "OPENED — connect page is the next VERIFIABLE-ish server piece; adapters/icons are founder-live." }
]
```
