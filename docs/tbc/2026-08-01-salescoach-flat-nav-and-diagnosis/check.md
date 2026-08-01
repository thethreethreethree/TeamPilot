# CHECK — Sales Coach flat nav + diagnosis

## Audit
- Manager gating preserved: `filterManagerNavSections` still filters `managerOnly` (Coach Assessment + Team
  hidden from reps) within the single flat section — a rep never sees a manager destination (A30, no cry-wolf).
- Universal "One Liners": removing the `isStandard` relabel means BOTH modes show it — closes the mode-specific
  cause of "edits don't stick" for the nav.
- Bounded blast radius: only the sidebar list + its now-dead mode hooks; MOBILE_TABS untouched.

## Findings (A26 sweep)
- No test asserted the grouped nav ("Manager Dashboard"/"Team Tools") — the managerNav helper test uses its own
  fixtures, so the flat data change doesn't break it.

## Verification
```
$ npx tsc --noEmit -p tsconfig.json
tsc_exit=0
$ npx vitest run --allowOnly=false src/lib/nav/__tests__/managerNav.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
Full `npm run check` is the CI gate.
