# BUILD - Pitch Performance leaves the website's nav

### No Pitch Performance tab or link, and the page is still reachable

- **write-path:** `SalesCoachShell.tsx` MACRO_MOBILE_TABS is Home / Today's Metrics / Role Play;
  `MacroModeToggle.tsx` desktop links are Door Log / Today's Metrics (grid of 2); `DoorLog.tsx` idle state links
  "See how your pitches went" to /dashboard/sales-coach/doors/report-card.
- **read-path:** `salesCoachShellNav.test.ts` "has no Pitch Performance tab ... and the Door Log still links
  to it"; captures `door-log` and `macro-toggle-links` (new) in both themes.

### The Macro Mode sentence is the founder's REV 1 wording

- **write-path:** `src/lib/coach/doorlog/macroModeCopy.ts` (MACRO_ON_BODY, MACRO_OFF_BODY, macroModeBody),
  word for word the app's macro-mode-copy.ts; `MacroModeToggle.tsx` renders `macroModeBody(enabled)` and shows
  nothing while the position is still loading.
- **read-path:** `macroModeCopy.test.ts` (3).
