# REVISION MANIFEST — sales-coach revision completion (retro-applied)

Added after the fact to demonstrate the completeness mechanism on the exact incident that motivated
it. Had this manifest existed when the *original* revision (`ce727c36`) was built, the two missed
items below would have shown as un-dispositioned — closure would have failed — and the founder would
not have had to re-report "this isn't fixed."

```json
[
  { "id": "SC1", "verb": "REMOVE", "item": "The four struck helper texts on the live-coaching screen (Opening-the-session, Works-on-earbuds, earpiece cue parenthetical, transcript+growth-review), keeping only 'Tap Start live coaching before you begin'.", "disposition": "done", "evidence": "grep: 0 of the four strings remain in LiveCoachingPanel.tsx; the kept line renders." },
  { "id": "SC2", "verb": "ROUTE", "item": "A Standard rep on an ended session lands on the After-Pitch Summary, not the manager summary/timeline.", "disposition": "done", "evidence": "load-time redirect in [id]/page.tsx: isStandard && status!==active -> router.replace(after-pitch); typecheck exit 0; after-pitch pushes to next session (no loop)." }
]
```

**The lesson, made concrete:** the original build shipped the rename + reorder + auto-coach (the
additions) and reported done — but SC1 (a *removal*) and SC2 (a *routing* change only wired on the End
action, not on reload) were never fully landed. Additions are salient; removals and edge-path routing
are not. A manifest that demands each requested change reach a disposition is precisely what makes the
non-salient items impossible to silently drop.
