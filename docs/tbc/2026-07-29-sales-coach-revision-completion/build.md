# BUILD — sales-coach revision completion

Files: `src/components/sales-coach/LiveCoachingPanel.tsx` (declutter),
`src/app/dashboard/sales-coach/[id]/page.tsx` (routing).

### Declutter (remove the four struck helper texts)

- write-path: **exists** — the edit removed the four strings from the component source ("Opening
  the session isn't…", "Works on earbuds…", the earpiece "(cue plays…)" parenthetical, "The
  transcript + growth review…"). human_can_set: n/a (a removal, not a control).
- read-path: **exists** — those strings no longer render on the live screen; the kept line "Tap
  Start live coaching before you begin" still renders. human_can_see: **yes** — decluttered screen.
- reachability: **BUILT** (grep: 0 of the four remain; 1 of the kept line).

### User post-session routing → After-Pitch (Standard)

- write-path: **exists** — a load-time useEffect: `if (isStandard && session.status !== "active")
  router.replace(.../after-pitch)`. Fires whenever a Standard rep views an ended/reviewed session
  (not only at the End action). The end-action's redundant push was folded into it. human_can_set:
  the rep reaching an ended session triggers it.
- read-path: **exists** — the rep lands on the After-Pitch Summary (its Start Next Door hand-off);
  the manager/Expert path still renders the full summary/timeline/pivot page. human_can_see: **yes**.
- reachability: **BUILT** — typecheck exit 0; after-pitch does not redirect back to this page
  (it pushes to the NEXT session), so no loop.

## Verification (A38)

`npm run check` output + exit code in closure.md's verification record.
