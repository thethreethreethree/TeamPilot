# Manager controls — Remediate

### Fix: unassign failure shows a light dismissible banner, not the full-screen error
what: the unassign handler now sets a local `actionError` string → a small dismissible banner renders above
the grid; the grid stays visible. The page-level `error` flag is reserved for a genuine LOAD failure.

gate-or-promise: promise. This is a UI-state choice in a client component (the gate can't render React, so
no unit test asserts the banner). The class boundary is documented: per-item action failures use local
action state, never the page load-error flag. The founder's visual-verification checklist covers the grid;
the promise is that new grid actions follow this local-error pattern (the sibling roster/coverage/timeoff
surfaces already do). A38-honest: not encoded in an automated gate — declared as a promise, hole named.
