# CHECK — the Scoreboard's band chip reads the one definition

Audited against the built files (§3.3.1). Every line reference below was opened in this session, and the two
faults in my own test were found by running it rather than by reading it.

## Canonical gate — `npm run check`

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  617 passed | 1 skipped (618)
      Tests  4058 passed | 15 skipped (4073)
exit: 0
```

## Targeted tests — `npx vitest run .../bandsSingleSource.test.ts`

```
 Test Files  1 passed (1)
      Tests  9 passed (9)
exit: 0
```

Coverage (9): 89.6 is Elite because the value being banded is an average; 89.4 is still Strong, so the rounding is
real and not a moved boundary; every boundary rounds up into its band and only below `min - 0.5` misses; values
outside 0–100 clamp rather than falling off the end; a numeric STRING bands the same as the number; a missing
average does not throw — and the test asserts that `bandFor` itself *does*, so the reason `bandForWire` exists is
pinned rather than described; and three render surfaces are checked at source level for a re-derived boundary.

## Mutation check — every guard proven by breaking it

```
the local band copy comes back              -> CAUGHT
bandFor stops rounding                      -> CAUGHT
bandFor stops clamping                      -> CAUGHT
wire helper stops coercing strings          -> CAUGHT
wire helper stops guarding a missing value  -> CAUGHT
exit: 0 (source restored in a finally block)
```

A sixth mutation — removing the string coercion in the component — was **MISSED** on the first run, and that was a
real hole rather than an equivalent-code artefact: the coercion had no test because it lived inside a `.tsx`
component where nothing could reach it. Moving it into `bandForWire` is what made it testable, and it is CAUGHT
now. The mutation is what found the crash below.

## Within-module pass (§1.5.1)

- **L1 structure.** One definition of the boundaries, one of the rounding, one of the wire-coercion. The colour map
  stays with the chip, because a colour is presentation; keying it by `PointsBand` makes a mistyped band a compile
  error rather than a chip with no colour.
- **L2 operational.** The chip now agrees with the Arena, the digest email and the alerts for the same rep.
- **L3 the person.** A rep on 89.6 is no longer told two different things about the same week by two surfaces of
  the same product.
- **L4 finish.** No visible change for a whole-number average, which is most of them — which is exactly why this
  survived unreported rather than unnoticed.

## Cross-module pass (§3.3.2 / A21)

The concept is "a band shown to a person". Inventoried across both repositories, because the app mirrors the web
and a divergence between them is invisible to either one alone.

| Surface | Bands by | State |
| --- | --- | --- |
| `bands.ts` (web, canonical) | `bandFor` | the definition |
| `Scoreboard.tsx` (web team board) | its own copy, unrounded | **fixed here** |
| `RepArena.tsx`, `MyProgress.tsx` (web) | the shared module | already correct — verified by reading, not assumed |
| `weeklyDigest.ts` (manager email) | `STRONG_SESSION_THRESHOLD` from the same module | already correct |
| `points.ts` (mobile) | its own `BANDS` + `bandFor`, mirroring the server | correct, and the app has no second copy — swept |

## Findings

### F1 — the Scoreboard re-derived the band boundaries, and did not round

class: a rule with one canonical definition, re-implemented at a render site "for convenience", where it drifts.
sweep: `grep -rn "points >= 90" src --include=*.ts --include=*.tsx` in the web repo, and the same shapes swept in
  the mobile repo. One hit outside `bands.ts`.
severity: high — it is a wrong verdict about a person's own performance, shown to their whole team, and the two
  surfaces disagree without either admitting it.

Verified adversarially rather than assumed: the boundaries and labels matched, so a glance would have called this a
harmless duplicate. Reading both implementations side by side is what showed the missing `Math.round` — the
difference was one line, and it was the line that mattered.

Fixed at `Scoreboard.tsx:35-60`.

### F2 — `bandFor` throws on a missing value, and the Scoreboard was one row away from it

class: a total function that is only total for the inputs its current callers happen to pass.
sweep: read every caller of `bandFor` in the web repo; the render sites are the ones fed straight from a wire
  payload, and they are the ones that can hand it `undefined`.
severity: medium — it needs a board row with no average to fire, and then it takes the whole screen rather than
  one chip.

`Math.round(undefined)` is NaN, no band's range contains NaN, and the non-null assertion dereferences undefined.
The old local copy survived it by accident, so a thoughtless swap to the shared function would have replaced a
wrong chip with a blank screen. Fixed by `bandForWire`, and pinned by a test that asserts `bandFor` still throws —
so the reason the wrapper exists cannot be forgotten and inlined away.

## Gate-the-lesson (§3.3.4 / A30)

Answered per fix in remediate.md.

## Inspected and NOT clean-billed (§3.3.5)

Inspected: both band implementations line by line, every caller of `bandFor` in the web repo, the three render
surfaces named in the source-level test, the mobile `points.ts`, and the digest's use of the threshold. **Not
inspected:** the rendered chip on a running board with a fractional average in it. Residual, not a pass.
