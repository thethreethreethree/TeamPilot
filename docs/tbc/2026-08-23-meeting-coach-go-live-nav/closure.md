# CLOSURE — Meeting Coach go-live: nav entry + module entitlement

## What shipped
Meeting Coach (Team-Sync) is now surfaced in the nav, gated behind the go-live flag. `moduleForPath` bundles the
meeting-coach subtree into the `sales_coach` entitlement (so the 0207 single-module lock no longer redirects a
sales_coach account away); the entry appears in the Sales Coach shell (sales_coach accounts) and the global sidebar
(hub accounts) only when `NEXT_PUBLIC_MEETING_COACH_ENABLED=true`. The env flag + the two migrations are recorded
as blocking setup steps with a verification procedure + rollback in `docs/MEETING-COACH-GO-LIVE.md` (§1.5.3). The
entitlement matrix (sales_coach reaches it / care denied / hub allowed) is unit-tested. Full `npm run check` exit 0.

**Remaining for go-live (founder — the external preconditions this build cannot satisfy):** apply migrations 0237
+ 0238 (`npm run db:apply`), set the env flag + redeploy, and device-validate on real hardware. All three are in
the go-live doc.

## The un-named reliance
- **The nav's visible appearance is confirmed only post-flag** — a flag-off build renders no entry, so the actual
  sidebar/shell appearance is verified at go-live, not in this (flag-off) CI.
- **The entitlement change expands sales_coach access to the meeting-coach subtree** — safe because the entry is
  flag-off and the page is A34-safe pre-migration, but it IS a live-auth behavior change (a sales_coach account
  manually URL-navigating to /dashboard/meeting-coach now lands there instead of being redirected).

## Residual (A36)

```json
[
  {
    "id": "go-live-external-preconditions",
    "item": "Migrations 0237+0238 apply, the NEXT_PUBLIC_MEETING_COACH_ENABLED flag + redeploy, and device validation remain — all founder-only.",
    "why_skipped": "External config the repo cannot hold (§1.5.3); documented + surfaced in docs/MEETING-COACH-GO-LIVE.md, not buried.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T06:40:00+08:00",
    "outcome": "Nav + entitlement built + gated; go-live is the founder-gated flip."
  },
  {
    "id": "meeting-coach-entitlement-is-sales_coach",
    "item": "Meeting Coach is bundled with the sales_coach entitlement (no dedicated meeting_coach module). A care-locked account cannot reach it.",
    "why_skipped": "Meeting Coach reuses the Sales Coach engine + shell (a defensible default, A20); a dedicated module would need a 0207 CHECK change + product decision. Revisit if Team-Sync should be its own entitlement.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T06:40:00+08:00",
    "outcome": "sales_coach + hub reach it; care does not — matches the sibling-of-Sales-Coach design."
  }
]
```
