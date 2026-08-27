# CHECK — Analytics merged into the Coach Assessment card

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test            Test Files  591 passed | 1 skipped (592)
                  Tests  3870 passed | 15 skipped (3885)
GATE_EXIT=0
```

## What this covers
- `managerNav` repOnly: hidden from a manager, kept for a rep (both branches) — the security-adjacent visibility rule.
- The nav order drift-guard still passes (order preserved; bound relaxed for the new comment).
- typecheck: the card consumes the scoresOnly skills; the route's new param compiles; NavItem.repOnly flows through the
  shared filter.

## Not unit-gated (founder visual-verify)
- The `SkillGrades` component rendering the six scores on an expanded card (a lazy client fetch — jsdom can't
  meaningfully exercise it). The scoresOnly route contract + the nav rule ARE unit-gated.

## Findings
No findings — the merge executes the founder's chosen scope (scores on the card, Analytics rep-only), reuses the
existing route/expand, and keeps cost bounded (no per-rep LLM on the manager page).
