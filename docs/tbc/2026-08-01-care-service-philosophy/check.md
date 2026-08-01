# CHECK — C.A.R.E service philosophy injection

## Audit (four-layer, §1.5.1)
- **L1 structure:** one exported constant, five imports. No duplicated prose to drift (the exact failure
  mode the codebase's shared-constant discipline exists to prevent).
- **L2 effectivity:** the constant reaches every reply-drafting surface — verified end-to-end by the wiring
  test calling `buildCareSystemPrompt(...)` and reading `CO_PILOT_SYSTEM` / `FORMULATE_SYSTEM`, plus a
  source-level check that both in-app routes apply it. Not "the string exists" — "the surface emits it."
- **L3 composition:** honesty rules emit BEFORE the philosophy; the injection fence emits AFTER it. So the
  philosophy cannot override honesty, and cannot weaken the untrusted-data boundary.
- **L4 surface:** the customer never sees the framework (no source names in the prompt), consistent with
  the existing IP-protection rule.

## Honesty-rule compatibility (the key risk from THINK §4)
The recovery clause ("own it, no half-measure") is scoped so it cannot make the AI promise a refund/credit/
exception it can't grant: it explicitly says to hand off warmly when the remedy isn't the AI's to grant,
never promise what it can't deliver, and it defers to the core rules. The identity block (which forbids
granting refunds/exceptions + requires handoff) still emits first and still wins. No conflict introduced.

## Findings (A26 proactive sweep)
No new defects. Confirmed Summarize is correctly excluded (a read, not a reply). Confirmed the fence stays
last on all four tool surfaces. Confirmed `buildCareSystemPrompt`'s existing tone directive still composes
(the philosophy fixes SHAPE + care; the tone setting fixes register).

## Verification
```
$ npm run check
… typecheck + lint + theme + rls + invariant-audit + tbc + test …
Tests  1962 passed | 15 skipped (1977)   ← includes servicePhilosophy.wiring.test.ts (+4)
exit 0
```
`npm run check` is the CI gate; it passed clean.
