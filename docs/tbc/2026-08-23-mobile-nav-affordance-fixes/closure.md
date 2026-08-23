# CLOSURE — mobile back-nav affordance (F1/F2) + label de-collision (F3)

## What shipped
The two DESIGN findings from the mobile Sales Coach UX audit that the founder chose via a picker:
- **F1/F2 — a systemic mobile "← Back"** in the shared `TopBar`, shown on every SC mobile page that renders
  TopBar (except the hub home), fixing the "no in-page back + no lit tab" disorientation on Roleplay / One Liners /
  any non-tab SC page. One change covers current + future pages (the founder's "systemic" pick over "targeted").
- **F3 — "Pitch Performance" de-collided:** the non-macro home card renamed to "Pitch Analytics", so that label
  now uniquely means the macro report-card tab.

+3 new TopBar detection tests + the F3 rename assertion; `npm run check` EXIT 0; non-SC routes byte-unchanged; no
route/schema/data change.

## The un-named reliance
- F1 relies on `router.back()` (standard history-back) — the rare empty-history case (a deep-link with no prior
  page) is bounded by the ever-present bottom nav. It relies on the SC home not rendering TopBar on mobile (true)
  plus the exact-path guard as belt-and-suspenders.
- The shared-TopBar change is contained to SC routes; verified no other test renders the real TopBar unmocked, so
  the added `useRouter` dependency can't silently break the suite.

## Residual (A36)

```json
[
  {
    "id": "door-log-no-in-page-back",
    "item": "Door Log (/doors) renders its own chrome (no TopBar), so the systemic TopBar back button does not reach it. A macro rep on Door Log has no in-page back and no lit tab.",
    "why_skipped": "Not a dead-end — the macro bottom nav's Home tab returns them, and Door Log is a focused field flow whose custom header is UX-sensitive (a back control could interfere with knocking). Lower priority than the TopBar pages the systemic fix covers.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T11:15:00+08:00",
    "outcome": "Flagged; add a back affordance to DoorLog's header if the founder wants parity — or leave it (Home tab suffices)."
  },
  {
    "id": "router-back-vs-deterministic-home",
    "item": "The mobile back button uses router.back() (history). For the dominant flow (home card → page → back) this returns to Home correctly; a fresh deep-link onto a sub-page has empty history so back() may no-op.",
    "why_skipped": "The bottom nav is always present as a fallback, and the deep-link-onto-a-subpage case is rare on a PWA that opens on Home. A deterministic 'back to SC home' is the alternative if the founder prefers it.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T11:15:00+08:00",
    "outcome": "Flagged; swap router.back() for a push('/dashboard/sales-coach') if empty-history back is ever observed."
  }
]
```
