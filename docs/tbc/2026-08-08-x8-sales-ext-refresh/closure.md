# CLOSURE — Sales Coach Extension: shared refresh route + detection-scope fix

## What shipped
1. **A detection-scope fix:** invariant-audit INVARIANT 8 ("every extension route authenticated") now scans
   BOTH `care/extension/` and `coach/extension/`. The 5 Sales Coach tool routes were previously outside its
   scan — authenticated, but unverified. Now they are covered.
2. **The refresh infra, via one mechanism:** `refreshExtensionSession` (shared handler) + both refresh routes
   calling it; the C.A.R.E route refactored (behavior preserved), the sales route
   (`/api/coach/extension/refresh`) added and allowlisted with the same different-auth-model reason.

## Un-named reliance (not self-evident)
- **The invariant's SCOPE is part of the invariant.** Widening the scan is not cosmetic: a gate that watches
  only the old namespace silently stops protecting a new one. Whenever another extension namespace is added,
  this regex must grow with it — otherwise the new routes are unguarded-and-unwatched, the exact gap this
  build closed. (The 5 sales routes were the live instance.)
- **The refresh route has NO entitlement gate ON PURPOSE.** The refresh_token IS the credential; the access
  token being refreshed is expired, so the entitlement gate can't run. It is allowlisted in INVARIANT 8 with
  that reason — do not "fix" it by adding guardExtensionRequest (that would 401 every refresh).
- **One mechanism, two mount points — do not re-fork.** `refreshExtensionSession` is generic Supabase refresh
  with no product coupling. Both routes are thin mappers over it. A future third extension reuses the same
  handler; it must never grow a per-extension copy of the Supabase grant.
- **This is NOT the whole auth handoff.** Refresh renews an EXISTING session. Obtaining the FIRST token needs
  the connect page + token mint (deferred, specced in the README). The extension still can't authenticate
  end-to-end until that lands.

## Flagged, not fixed (§3.3)
- The sales `connect` page + token mint + the `sales-connect` background receiver — the rest of the auth
  handoff — remain Phase 2b (README + memory). Refresh alone does not make the extension loadable.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The first-token auth handoff (sales /extension/connect page + token mint + the sales-connect background receiver) is not built.", "why_skipped": "Refresh renews an existing session; the FIRST token needs the connect handoff, which is a UI page + a browser-runtime receiver (Phase 2b, unverifiable in a no-browser sandbox) and touches the entitlement-source decision the founder still owns. Refresh was the decision-independent, sandbox-verifiable piece; it is done.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T05:14:00Z", "outcome": "OPENED — build the sales connect page + token mint with Phase 2b, after the entitlement-source decision." }
]
```
