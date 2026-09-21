# REMEDIATE

### The screen explained itself with a dependency that had already been satisfied

gate-or-promise: declined
- Declined deliberately, with the hole named. The class is "a comment or an on-screen sentence
  whose truth conditions changed underneath it", and it has no precise mechanical form. A checker
  for prose that mentions a table would flag every accurate comment in the codebase; A30 is
  explicit that a gate which cries wolf is worse than none, because it teaches people to skip the
  one that matters.
- What is done instead is narrower. The corrected note quotes the claim it replaces and dates the
  correction, so the next reader sees that this file has already been wrong once about exactly
  this. And the remaining dependency is now stated as a thing someone must *build* rather than a
  thing that must *happen*, which cannot expire the same way.
- **The hole:** nothing prevents the next time-conditional promise. If a detector ships without
  updating this screen, it will claim detection is unbuilt while running.
- The nearest thing to a real gate would be a rule that an empty state naming a dependency must
  name it as a code symbol a test can assert on. That is a design convention, not a check, and it
  is recorded here rather than invented into a half-gate.

### The nav wired a link to a route the repository did not contain

gate-or-promise: gate
- Already gated, and it held: `reachability:audit` is in `npm run check` and in CI, and it fails
  on a module nothing reaches. What it does not cover is the inverse — a nav `href` with no page
  behind it — because the untracked page existed on disk while the audit ran, so the working tree
  was consistent even though `main` would not have been.
- The operative defense here was procedural and is worth stating plainly: the files were committed
  together, verified by listing the staged set against the hrefs in the staged diff, and that
  check is written into check.md as a runnable sweep rather than left as a habit.
- **The hole:** a gate that compares nav hrefs against `src/app` routes would close it properly
  and is precise enough to exist — every `href` in `NAV_SECTIONS` is a literal. Not built in this
  build because it belongs with the nav change rather than bolted to it under time pressure, and
  building a gate badly is how the noisy ones get made. Named as residual R2.

### Two screens will count "open" differently when the detector is built

gate-or-promise: promise
- A promise, knowingly, because there is nothing yet to gate: no detector, no `patterns` table, no
  second screen. A test asserting a definition that nothing implements would pass vacuously and
  give false assurance that the contradiction was handled.
- The carrier is the docblock, which states the contradiction, names both readings, says which one
  to pick, and points at LOGIC-AND-CONTRADICTIONS.md C8. A30's own diagnosis says prose returns —
  so this is recorded as a known weak defense rather than as a resolution, and the moment the
  detector exists the definition becomes gateable and should be gated.
