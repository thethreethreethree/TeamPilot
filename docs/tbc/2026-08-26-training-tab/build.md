# BUILD — Training tab (slice 2 of the training system)

### the rep-self route (my-training)
- write-path: `my-training/route.ts` — GET, any authenticated caller. Reads the CALLER's OWN `coach.dissect_generated`
  events (actor = uid, newest 50), aggregates via `aggregateDissectContent`, returns deduped growth / strategies /
  strengths + best-effort `getAllTimeKpi(uid)`. No manager gate (self-data). Returns `{degraded:true}` on a read error.
- read-path: the Training page's rep branch fetches this and renders the caller's own "Work on" + "Moves to add" lists.

### the shared brief panel (drift removal)
- write-path: `TeamTrainingBriefPanel.tsx` — the brief Build-button + fetch + `TeamBriefCard`, extracted so ONE source
  serves both surfaces. `coach-assessment/page.tsx` refactored to render `<TeamTrainingBriefPanel />` in place of its
  former inline copy (inline `TeamBriefCard` + brief state/callback removed).
- read-path: both the Coach Assessment view and the Training tab render the identical panel; a change lands in both.

### the Training page (role-branched)
- write-path: `training/page.tsx` — tries the manager team-read (`coach-assessment` route); `ok` → manager mode
  (panel + per-rep trainings from `team[]`); a non-manager gets 403 → falls back to `my-training` → rep mode (own
  trainings only). Honest empty states in every branch.
- read-path: a manager lands on team brief + every rep's focuses; a rep lands on their own focuses — each a working
  destination, no bounce.

### the nav entry
- write-path: `SalesCoachShell.tsx` — a "Training" item (GraduationCap) in the Team Tools group, NOT managerOnly.
- read-path: both roles see the nav item and reach a role-appropriate page (AMD-006 layer-3 continuity).

## Files
- `src/app/api/coach/sales-session/my-training/route.ts` — rep-self trainings route.
- `src/components/sales-coach/TeamTrainingBriefPanel.tsx` — shared brief panel + TeamBriefCard.
- `src/app/dashboard/sales-coach/training/page.tsx` — the role-branched Training tab.
- `src/app/dashboard/sales-coach/coach-assessment/page.tsx` — refactored to the shared panel.
- `src/components/sales-coach/SalesCoachShell.tsx` — the Training nav item.

## Ripple (holistic — §6 item 5)
- No schema change, no new engine, no new LLM call this slice. The inline brief moved out of Coach Assessment into the
  shared panel — a net drift REMOVAL, not a new copy.
- Slice boundary held: materials / exercises / live AI practice feedback are the founder-DEFERRED next slice, absent here.

## Honest limit
Rep "trainings" are the growth/strategy focuses distilled from that rep's Dissects — real signal, but text-list depth,
not yet interactive materials or a practice loop (the deferred slice). A rep with no dissects yet sees an honest empty
state rather than seeded content.
