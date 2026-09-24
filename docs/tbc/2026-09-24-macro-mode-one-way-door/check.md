# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json
(no output)
exit 0
```

```
$ npx vitest run src/app/api/me
 Test Files  5 passed (5)
      Tests  32 passed (32)
exit 0
```

```
$ npx vitest run src/app/api/coach/sales-session/macro-mode
      Tests  10 passed (10)
exit 0
```

## Mutants, each restored

| Mutation | Result |
|---|---|
| Remove the Exit button | `Macro ON: there is a way OUT without swiping` fails by name. |
| Revert the POST to echoing `body.enabled` | 3 of 10 macro-mode tests fail: the zero-row 500, the no-echo assertion, and the stored-value assertion. |

## It was looked at

Rendered at 390px — a real phone width — with the compiled Tailwind bundle, and opened.

The FIRST capture showed the Exit button clipped by the right edge, reading only "Ex". I did not
report that, because I had extracted the `md:hidden` subtree out of its parent flex chain and the
container was therefore unconstrained. Re-rendered inside a 390px column: both controls fit on one
row with margin to spare, "← Back to ELOSTATE" left and "← Exit Macro Mode" right.

**[OBSERVED]** the fix renders correctly at phone width.
**[OBSERVED]** an artifact of my own harness looked exactly like a layout bug, which is worth
recording as a property of this tooling rather than a one-off.

## Findings

### A mode you cannot leave

class: a mode whose ENTRY is always reachable and whose EXIT is conditional on the state that mode creates
sweep: `grep -rn "MobileHomePager|macroOn === true" src --include=*.tsx`
severity: high

**[OBSERVED]** the only Macro Mode control in the mobile Macro branch sits on page 1 of a pager
that opens on page 0 every launch by design.

**[OBSERVED]** desktop is unaffected — `page.tsx:588` renders it unconditionally.

**[INFERRED]** a mobile rep who turns it on has no way to turn it off, which is what the founder
described.

### The sweep for the same class is NOT clean, and is not finished

class: as above — an entry-only mode switch
sweep: `grep -rn "experience_mode|learning_mode_enabled|isStandard" src/components src/app --include=*.tsx | grep -v __tests__`
severity: medium

**[ASSUMED]**, and this is the honest part: the product has at least two other per-user mode flags
— `experience_mode` and `learning_mode_enabled` — that change what the UI shows. Whether either
can hide its own off-switch was **not** verified. The macro case took a founder report to find,
which is exactly the evidence that reading for correctness does not surface this class.

Naming it rather than claiming the sweep found nothing.

### The false-ok write class

class: a mutation that reports success without checking rows affected
sweep: for each route file containing `.update(`, assert a `.select(` appears within six lines
severity: medium

**[OBSERVED]** 30+ routes match the pattern. Five write to the caller's own `profiles` row — the
exact shape found here — and all five are fixed.

**[ASSUMED]** the remaining ~25 (finance, tasks, schedule, chat, care) are the same class, but each
needs verifying adversarially: some use a service-role client, where a zero-row write means
something different. NOT done. This is a suspect list, not a defect list.

## What this does not prove

**The founder's instance is [INFERRED], not reproduced.** The mechanism explains their exact words
and the code is unambiguous, but nothing here ran against their account. If they are still stuck
after this ships, the diagnosis was wrong and the next step is their session, not more reading.
