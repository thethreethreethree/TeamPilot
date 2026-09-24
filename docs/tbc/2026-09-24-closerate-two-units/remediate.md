# REMEDIATE

### One payload carries `closeRate` in two units

gate-or-promise: gate

The drift-guard in `readTeamAssessment.test.ts` asserts the rep row is above 1, the team KPI is at
or below 1, and that they describe the same quantity. Removing the conversion fails it by name;
pre-multiplying the team value would make `pct()` double-convert and fail the same test from the
other side.

That gate holds the **current arrangement**. It does not stop a new call site reading `closeRate`
and guessing wrong, because a guess at a fresh call site is not a change to either producer.

**The real fix is the rename**, `RepRow.closeRate` → `closeRatePct`, 19 references, compiler-checked.
It is deferred, not declined, for a reason that is on the record in two places
(`docs/DEMO-READINESS-2026-09-24.md` §6 and build.md): it changes a wire key, and a browser holding
the previous bundle would render `undefined%`. The afternoon of an investor demo is when that trade
is worst.

**Do it after the demo.** The compiler makes it mechanical; only the deploy window makes it risky,
and that window closes on any ordinary day.

### My own tests were green about nothing, four times today

gate-or-promise: promise

No gate, and I am not going to invent one — "does this test actually measure what it says" is not a
property a script evaluates, and building something that pretends to would be the decoration A30
warns about.

**The promise, in the order they actually caught things today:**

1. A **positive** assertion, never only negative ones. `queryByText(...).toBeNull()` passes on an
   empty container, which is exactly what a crashed render leaves behind. The RepArena test passed
   against the crash it was written for until it asserted content that only exists on success.
2. **No early `return`** in a test. `if (x === null) return` is a silent skip wearing a pass.
3. **Typecheck, not just vitest.** Vitest does not typecheck, so a fixture with a property the
   helper rejects runs green. `npm run check` returned `CHECK_EXIT=2` and found it.
4. **Revert the fix and watch it fail by name.** The only one of the four that is mechanical, and
   the one I now do by default.

The pattern underneath: every vacuous test had the same shape as the defects being hunted —
correct-looking, and about nothing. The thing that separated them was always a step OTHER than
running the unit test.

### The phantom itself

gate-or-promise: declined

No fix. A rendered screenshot is evidence about the renderer, not about the data, and treating one
as proof of a data bug is a reading error rather than a code defect.

Recorded because the near-miss is the lesson: three fixture-induced phantoms today, and the third
would have gone to a founder as "your demo has a 100x numeric error" hours before the room. What
stopped it was reading the producer — `readTeamAssessment.ts:196` — rather than the two render
sites that framed the story so well.
