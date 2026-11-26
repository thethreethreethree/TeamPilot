# CHECK - Acting on the third review

## Commands

```
npx vitest run delete-recording save-recording → 22 passed (tree / hidden / failed check / owner)
npx vitest run RemoteCallPanel.simple.render → 5 passed (no-recording questions are text)
npx vitest run erasureCoverage → 4 passed (0351 is the latest body; signals by source)
node scripts/invariant-audit.mjs → Violations: 0 (no stale hide-route entries)
node replay0351.mjs → 0350: "c2:Call Dana back, mis-filed" left · 0351: "c2:[erased]" · "c2:B own task" untouched
npm run db:apply → ✅ ALL 33 invariants hold
probe_fn.mjs (live) → signals by source alone: true | old company pin gone: true | events by subject: true; grants postgres,service_role
probe_sig.mjs (live, counts) → misfiled callback signals 0, misfiled callback task events 0
```

## Findings

### F1 - delete-recording / save-recording reached a call outside the manager's tree or hidden from them
class: a service-role read that skips RLS's tree and hide rules.
sweep: invariant 43 widened; the nine newly matched routes were read — each opens the call through the caller's client first, or never returns call content.
severity: medium (a write on a call; no content returned)

### F2 - invariant 43 saw three tables
class: an audit scoped to the examples that taught it.
sweep: table list taken from 0337/0339/0341.
severity: medium

### F3 - 0350's signals scrub kept the company pin
class: a condition change applied to one of two sibling statements.
sweep: every other p_company term in the body filters a table keyed by the requesting company's own rows; production holds 0 such signals.
severity: low

### F4 - "Play from here" live with no recording
class: dead control.
sweep: the lane buttons beside it were already disabled when there is no audio.
severity: low

### F5 - score events are not erased
class: erasure scope.
sweep: n/a — a founder decision (picker).
severity: low (pre-existing; a founder decision — picker)

### F6 - `_` in 0348/0349 LIKE patterns
class: pattern looseness.
sweep: no subject in the codebase collides.
severity: low (nit; no effect today)
