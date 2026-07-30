# BUILD — C.A.R.E "General" tab (comprehensive settings, pillar 2)

Files:
- `src/app/dashboard/care/settings/general/page.tsx` (NEW) — the General tab: `<LearningModePanel/>` +
  `<ExperienceModePanel/>` (per-user, self-contained) + a jump-map (AI / Widget / Account) with LearningHints.
- `src/components/care/SettingsTabs.tsx` — added `{ /settings/general, "General" }` as the FIRST tab.
- `src/app/dashboard/care/settings/page.tsx` — added the "General" landing card (first); REMOVED the
  landing's `<ExperienceModePanel/>` block + its now-unused import (moved to the General tab).

### General tab (per-user dials + settings map)

- write-path: **exists** — Learning/Experience mode save via their OWN existing endpoints (per-user prefs);
  the General page adds no Save of its own. human_can_set: **yes** — the two panels.
- read-path: **exists, unchanged** — the same per-user preference used app-wide.
- reachability: **BUILT** — SettingsTabs + landing card link the page; the jump-map links the rest.
- clobber risk: **none** — the page touches no tenant config (A30, structural).

## Verification (A38)

`npx tsc --noEmit -p tsconfig.json` → exit 0 (new page + the landing import removal compile).
