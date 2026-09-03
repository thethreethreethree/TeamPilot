# REMEDIATE — fixes, and whether each is a gate or a promise

### F1 — the Scoreboard re-derived the band boundaries

What changed: the local `band()` now calls `bandForWire`; only the colour map, keyed by `PointsBand`, stays with
the chip.

gate-or-promise: gate

Two gates, deliberately, because the failure had two halves and no single check catches both.

The BEHAVIOUR is pinned by tests that name it — *"89.6 is Elite, because the value being banded is an AVERAGE"* —
and proven by mutation:

```
the local band copy comes back  -> CAUGHT
bandFor stops rounding          -> CAUGHT
exit: 0
```

The DUPLICATION is pinned by a source-level check, and it has to be: no behavioural test can see a second
definition, because both copies pass their own tests. The only observable is that two files disagree, and that is
visible in the source or nowhere.

That check is narrow on purpose (A33): it reads three named render surfaces for the band boundaries as literals,
with comments stripped — not every number in the repo. A gate that cried wolf on unrelated numbers, or on an
accurate comment, is one people learn to skip, and the real duplicate would ride in behind six false ones. **It
already cried wolf once**, on RepArena's header comment, and that was fixed rather than tolerated.

### F2 — `bandFor` throws on a missing value

What changed: `bandForWire` coerces the PostgREST string and guards a missing or unreadable value, banding it as
the lowest rather than throwing.

gate-or-promise: gate

```
wire helper stops coercing strings          -> CAUGHT
wire helper stops guarding a missing value  -> CAUGHT
exit: 0
```

The test asserts that `bandFor` itself still throws on `undefined`. That is the load-bearing part: it pins the
REASON the wrapper exists, so a future reader who finds `bandForWire` redundant and inlines it will fail a test
that explains why rather than silently reintroducing a blank screen.

### My own test's two faults

gate-or-promise: declined, and named

Neither is a defect in the product, so neither gets a gate — a check that verified my checks would be the same
regress one level up. Both are recorded in build.md and check.md instead, because the second one is instructive:
my rounding assertion was backwards in exactly the way the Scoreboard's copy was, approached from the other side.
The lesson is not "add a gate", it is that a boundary with rounding has three interesting values, not two, and I
wrote two.
