# CLOSURE — Sales Coach collapsible nav groups

## What shipped
The Sales Coach desktop sidebar now groups its items per the founder's 2026-08-12 mockup: Home stays
top-level; **Manager Dashboard** (Coach Assessment, Analytics, Sessions) and **Team Tools** (Roleplay, One
Liners, Team) are each a COLLAPSIBLE group (header toggle + chevron, items under a left rule); Team Chat, KPI
Analytics, Browser extension, and Settings stay top-level below. Both groups default open and auto-re-open
when the active route is inside them, so collapsing is a convenience that can never hide the user's own
location (AMD-006 Layer 3). Item-level manager-only gating is unchanged (Coach Assessment + Team hidden from
reps). Implemented by mirroring CareShell's proven "C.A.R.E Tools" expander (A28), reusing the existing
section model + `filterManagerNavSections`. Mobile (the PWA bottom-tab bar) is untouched.

## Founder decision surfaced (§2 — history the founder should weigh)
This grouping is not new: it shipped 2026-07-31 and was **reverted to a flat list on 2026-08-01** at the
founder's request. The founder re-requested it on 2026-08-12 **with a collapse affordance** — that
collapsibility is the material new requirement and why this is not a re-litigation of the 08-01 revert. Built
per the current, explicit instruction; flagging the reversal so the founder is deciding with full context.

## Un-named reliances (A35)
- **`filterManagerNavSections` preserves `header`/`collapsible`.** Correctness of the rendered groups relies on
  the filter spreading `...s` (verified in managerNav.ts) so the new fields survive the manager filter.
- **SalesCoachShell is a persistent App-Router layout.** The `useState` group-open initializer fires once; the
  `activeGroupHeader` effect is what re-opens a group on later navigation into it (Cmd+K / back / in-page link).
  Verified via src/app/dashboard/sales-coach/layout.tsx wrapping all routes.
- **Runtime visual state deferred to the founder's deployed check.** The Sales Coach route is auth-gated and no
  dev server / logged-in session was available for a headless render this session — consistent with this
  shell's standing "UNTESTED at runtime" posture. Typecheck + the substring/structure tests + mirroring a
  proven affordance are the assurance here; the founder will see the rendered result on deploy.

## Residual (A36 — ranked by confidence-it-does-not-matter; top OPENED)
```json
[
  { "id": "R1", "item": "Group open/closed state is not persisted across full page reloads (resets to open).", "why_skipped": "Mirrors CareShell's toolsOpen (also not persisted); the default-open restore is the intended, discoverable baseline. Persisting is a low-value follow-up if the founder wants it.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-12T01:25:00Z", "outcome": "Opened + assessed: confirmed the state is component-local (useState, no localStorage) and resets to the OPEN default on each full load, exactly like CareShell's toolsOpen. This is intended (a full reload restoring the expanded baseline is the discoverable default; the auto-expand-active effect still prevents stranding). Not a defect — persisting is a founder-optional follow-up, not shipped to avoid adding a localStorage surface no one requested." },
  { "id": "R2", "item": "A rep (non-manager) sees a group literally titled 'Manager Dashboard' that, for them, contains only Analytics + Sessions (Coach Assessment is hidden).", "why_skipped": "Faithful to the founder's mockup labels; changing rep-facing wording is a Layer-4 call the founder should make, not one to decide unilaterally. If undesired, the whole group can be made manager-only (reps get ungrouped Analytics/Sessions instead).", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T01:26:00Z", "outcome": "Surfaced to the founder in the closure + action queue as a Layer-4 wording decision; built per the mockup's labels pending that call." }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (12) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 394 passed | 1 skipped (395); Tests 2721 passed | 15 skipped (2736)
CHECK_EXIT=0
```
