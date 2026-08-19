# Manager controls — Closure

## What shipped
Three founder-picked manager controls (2026-08-19 picker):
1. **Cell-click unassign** — a manager clicks a shift cell in the weekly grid → confirms → the person is
   removed (`EMPLOYEE_UNASSIGNED`), the grid reloads, coverage re-checks. Fills the gap where a mis-assigned
   person could not be removed at all.
2. **Manager-only visibility** — a `layout.tsx` server gate redirects non-managers away from every schedule
   page, reusing the same `isAdmin` predicate the APIs enforce (single-source, §2.2).
3. **SHIFT_CANCELLED tombstone** — the append-only shift-cancel primitive (schema + projector + route gate +
   tests), foundation for the next build's replace-the-week re-import.

## Verification (A38)
Canonical gate re-run after the self-audit fix:

```
npm run check   →   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
Test Files  … passed
Tests       … passed
EXIT: 0
```
(Full paste in the commit; the run is what "verified" refers to — not a hand-picked subset.)

## Residuals (ranked; A36 — top must be opened)
```json
[
  { "id": "R1", "item": "The unassign confirm uses the native window.confirm dialog, not a styled in-app modal.", "why_skipped": "A native confirm is a standard, accessible destructive-action guard; styling it is cosmetic polish that can follow.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-19T20:40:00Z", "outcome": "OPENED + confirmed: the confirm() is SSR-guarded (typeof window check) and blocks the POST until the manager accepts, so a mis-click cannot unassign; a styled modal is later polish with no correctness impact." },
  { "id": "R2", "item": "Cell-click unassign + the error banner are browser-only, unverified by the gate.", "why_skipped": "The gate cannot render React; the events route + EMPLOYEE_UNASSIGNED projector backbone are unit-tested, and the UI wiring is on the founder's visual checklist (grid screen).", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R3", "item": "Retime (change a shift's time) is not built.", "why_skipped": "A shift-level edit deferred alongside the cancel UI; it maps to a correcting SHIFT_DEFINED.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R4", "item": "SHIFT_CANCELLED ships without a dedicated cancel button or the replace-the-week consumer.", "why_skipped": "Foundation-first by design — the primitive + projector + gate + tests ship now; the cancel button and replace-the-week re-import are the NEXT build. Reachable via the events route today.", "confidence_it_does_not_matter": "low", "opened_at": null }
]
```
