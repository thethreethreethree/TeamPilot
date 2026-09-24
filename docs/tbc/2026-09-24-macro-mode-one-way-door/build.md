# BUILD — the way out, above the pager

### An escape that does not require knowing to swipe

- **write-path:** an "Exit Macro Mode" button in the header row of the Macro mobile home
  (`src/app/dashboard/sales-coach/page.tsx`), beside "Back to ELOSTATE" and **above**
  `MobileHomePager`.
- **read-path:** a render test asserting, with Macro Mode on, that a control named "exit macro
  mode" exists AND that the pager does not contain it.

Placed there for the reason its neighbour is there. The file already says it about the other link:
*"'Back to ELOSTATE' stays ABOVE the pager so it's reachable from either page."* The same sentence
is the fix.

The full `MacroModeToggle` card stays on page 1. This is an escape hatch, not a second copy of the
setting — two controls for one preference on one screen is the confusion avoided an hour earlier
when the theme toggle was route-gated.

It calls the same `toggleMacro` the card calls, so it inherits the optimistic update, the rollback
on failure, and the `elostate:macro-mode` broadcast that keeps the shell's sidebar in step. Nothing
new to drift.

### The test pins the property, not the button

- **write-path:** `macroCardVisibility.render.test.tsx`.
- **read-path:** removing the button fails it by name:

```
$ npx vitest run src/app/dashboard/sales-coach/__tests__/macroCardVisibility.render.test.tsx
     × Macro ON: there is a way OUT without swiping (founder 2026-09-24 — the one-way door)
      Tests  1 failed | 3 passed (4)
exit 1
```

Two assertions, deliberately: the control exists, and it is **outside** the pager. The second is
the one that matters — an escape inside the pager lands on one page or the other, and the trap
moves instead of closing. A future redesign is free to relocate it; it is not free to hide it
behind the swipe again.

### Also fixed, and NOT the answer to the report

- **write-path:** the verified `.update(...).select(...).maybeSingle()` in
  `macro-mode/route.ts` and the four sibling routes under `src/app/api/me/`.
- **read-path:** ten new macro-mode tests, three of which fail when the echo returns; plus the
  five `src/app/api/me` suites, whose mocks now model the verified chain and echo the patch —
  a mock answering a fixed value would pass while the route handed the caller their own input
  back, which is the bug being removed.

`macro-mode/route.ts` POSTed `.update().eq()` and checked only `error`. A write matching zero rows
returns no error and no row count, so the route answered `{ enabled: true }` whether or not
anything was written. Now it selects the row back, 500s with a log line when nothing was, and
returns the **stored** value rather than echoing the caller's input.

Swept (A26): five routes on `profiles` shared that shape — macro-mode, `/api/me/theme`,
`/api/me/learning-mode`, `/api/me/experience-mode`, `/api/me/care-notifications`. All five fixed,
each returning what the database holds. `/api/me/theme` matters more since this morning, when a
ThemeToggle was mounted in the Sales Coach header: the whole reason it is the app's toggle rather
than a local one is that the choice persists cross-device through that route.

Ten new tests on macro-mode, which had none.
