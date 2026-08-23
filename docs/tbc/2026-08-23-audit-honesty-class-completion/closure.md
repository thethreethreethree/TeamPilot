# CLOSURE — desktop error-as-no-data + Door Log back (audit class completions)

## What shipped
Two completions of already-authorized audit work, swept to their A26 boundary:
- **Desktop home tiles** now show "—" on a failed dashboard fetch (not a false "0") — completing the
  error-as-no-data class F4b started on this page's mobile pill, per the founder's standing "sweep + fix" directive.
- **Door Log** gained an idle-only "← Sales Coach" in-page back — completing the founder's "systemic back — one fix
  covers all" picker choice to the one SC mobile surface that renders no TopBar.

+2 detection tests (one new file for the desktop tiles, +2 assertions in the Door Log flow test); `npm run check`
EXIT 0; a genuine zero still shows 0; no route/schema/data change.

## The un-named reliance
- The desktop tiles rely on the pre-existing F4b `statsError` flag (set on fetch-failure) — they are a new
  consumer, no new fetch/state. `DeckStat.value: ReactNode` makes "—" type-clean.
- Door Log's back is a deterministic Link to the SC home (not `router.back()`), so no empty-history edge; it is
  idle-only so it never competes with the field flow's bottom-anchored controls.

## Boundary (§5 — honest about stopping)
This is the last authorized, non-gold-plating audit remediation. Beyond it, the backlog is: D3 (coverage-race —
latent, cannot manifest one-cue-at-a-time), D5 (UI polish — the founder scoped this session to "D1 and D2"),
device validation (founder-side), and the earlier residuals (router.back-vs-home, desktop banner-vs-marker). The
honest next state is a hold for the founder's device validation / direction — not more autonomous change.

## Residual (A36)

```json
[
  {
    "id": "boundary-remaining-backlog",
    "item": "Remaining un-built items: Meeting Coach D3 (coverage whole-JSONB race — latent), D4 (multi-company assertions — deferred to that milestone), D5 (Prep-up UI polish — founder scoped this session to D1/D2), and device validation of all shipped mobile work.",
    "why_skipped": "D3 cannot currently manifest (one cue at a time); D4 is founder-deferred; D5 is founder-scoped-out; device validation is founder-side (unverifiable headlessly). Building D3/D5 now would be gold-plating / overtaking an explicit scope choice (A24 / §3.3).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T11:45:00+08:00",
    "outcome": "Held for the founder's direction; each is a discrete follow-up they can pick."
  },
  {
    "id": "desktop-tiles-marker-vs-banner",
    "item": "The desktop tiles show '—' per tile on failure (consistent with the mobile pill + macro totals on this page). The analytics page uses a full error banner instead; the two honesty patterns differ across pages.",
    "why_skipped": "'—' matches THIS page's established pattern (mobile pill + macro totals); a page-wide banner is a broader UX-consistency decision. Low impact.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T11:45:00+08:00",
    "outcome": "Flagged; unify on one honesty pattern app-wide if the founder wants."
  }
]
```
