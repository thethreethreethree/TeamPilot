# CHECK — deal-value capture on the After-Pitch page

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  593 passed | 1 skipped (594)
        Tests  3909 passed | 15 skipped (3924)
PIPE_EXIT=0
```

## What this covers
- typecheck: `recordOutcome(outcome, dealValue?)` + `saveDealValue` + the inline input compile; `Session.dealValue`
  flows from the mapped session; the POST body includes dealValue only when provided.
- The `/outcome` route (incl. the `dealValue` field) is already unit-tested (outcome.route.test.ts); this change
  reuses it unchanged.

## Not unit-gated (founder visual-verify)
- The inline "Deal value" input rendering on 'sold' and the save round-trip on the after-pitch client page (no jsdom
  harness). It mirrors the session page's already-shipped pattern field-for-field, and the wiring is typechecked.

## Findings
No findings — a low-friction, optional mirror of the session page's deal-value capture, reusing the backend
unchanged; unblocks Revenue / Avg-deal-size for reps who close on the after-pitch screen.
