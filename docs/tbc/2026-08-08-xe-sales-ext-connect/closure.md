# CLOSURE — Sales Coach Extension: connect handoff (Sign in end-to-end)

## What shipped
The last piece for a working extension: `/extension/connect` is now product-aware and serves the sales
extension (`?product=sales` → `sales-connect` handoff, pinned to `NEXT_PUBLIC_SALES_EXTENSION_ID`), with the
C.A.R.E path preserved byte-for-byte. Sign in now works end-to-end: panel → worker → connect page → token
stored. Plus the new env var (INV9 allowlist + `.env.example`) and a connect↔worker message-type guard.

## Un-named reliance (not self-evident)
- **Default-preserving is load-bearing.** `product` defaults to "care"; the C.A.R.E connect path (strings,
  message type, pinned env) is unchanged. Do not make `product` required or change the default — it would
  silently alter every C.A.R.E connect.
- **The handoff is PINNED per product, on purpose.** The token goes only to the product's official extension
  id (`NEXT_PUBLIC_SALES_EXTENSION_ID` for sales). Set it in prod. Until it's set (dev), the page hands off to
  the URL-supplied id but WARNS — the same anti-exfiltration posture as C.A.R.E; do not "simplify" away the
  pin.
- **The connect message type is a cross-artifact contract with the worker.** The page emits `sales-connect`
  and `background.js` listens for exactly `sales-connect`. The guard test locks them together — if either
  changes, Sign in breaks silently (a token the worker ignores), so change both or neither.
- **Sign in still needs the extension INSTALLED with the pinned id set for auto-connect.** In dev (unpacked,
  unset id) it hands off to the per-install id from the URL. For a public launch, set
  `NEXT_PUBLIC_SALES_EXTENSION_ID` to the Web Store id.

## The extension is now functionally complete (server + client + auth)
Download → install → Sign in → run the 5 tools all wired. Remaining before a public launch: a real Sales
Coach ICON (placeholder today) and the founder's ENTITLEMENT-SOURCE decision (the tool routes 402 on an
unentitled tenant — the message already names the sales product). Both are founder calls, not engineering
gaps.

## Flagged, not fixed (§3.3)
- A real Sales Coach icon (not the C.A.R.E placeholder) — founder design follow-up.
- The entitlement-source decision (share C.A.R.E's vs a separate sales SKU) — founder pricing decision.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "NEXT_PUBLIC_SALES_EXTENSION_ID must be set in prod to pin the token handoff; until then the page hands off to the URL-supplied ext id (dev posture).", "why_skipped": "The official id isn't known until the extension is packed/listed; the dev warn-but-proceed path matches C.A.R.E. Set it at launch.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T06:50:00Z", "outcome": "OPENED — set NEXT_PUBLIC_SALES_EXTENSION_ID to the official id before a public launch." }
]
```
