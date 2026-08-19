# Manager controls — Check

Proactive four-layer self-audit (§1.5.2) of the just-built surfaces.

### Finding: unassign failure nuked the whole grid
class: a transient single-action failure escalated to a full-surface error state (the action handler
set the page-level `error` flag, replacing the entire grid with the full-screen error card + Retry).
The class is "a per-item action's failure path reuses the page's global load-error state," which loses
unrelated visible content for one failed click.

sweep: `grep -n "setError(true)" src/app/dashboard/schedule/grid/page.tsx` — the only remaining
`setError(true)` uses are the page LOAD path (correct: a failed initial/reload read genuinely has no grid
to show). The unassign action path no longer uses it. Sibling schedule action surfaces (roster/coverage/
timeoff) already use local per-action state, not the page load-error — so this was isolated to the new
grid handler, not systemic.

severity: low (UX; recoverable via Retry, but disproportionate — a manager mid-review lost the grid on one
failed unassign).

## Verification
`npm run check` — output + exit code pasted in closure.md (A38). Typecheck clean; the +2 deriveState tests
and the full schedule suite pass.

No other findings: the visibility gate reuses the API's `isAdmin` predicate (no re-derivation, §2.2); the
unassign path has a `busyRef` re-entrancy latch (double-click safe); `window.confirm` is guarded for SSR;
SHIFT_CANCELLED mirrors the existing tombstone and is projector-tested + route-gated.
