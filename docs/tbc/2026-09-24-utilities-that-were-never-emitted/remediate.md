# REMEDIATE

### `bg-<token>` was never a utility

gate-or-promise: **gate**, and it is the first real one written today

`src/__tests__/no-wrong-namespace-color-utilities.test.ts`. It derives its token list from the
config rather than hard-coding it, so a token added tomorrow is covered without anyone remembering
to update the test. It asks Tailwind's own resolver rather than parsing anything. It passes on day
one because the offenders were fixed first, and it **fails when it should** — mutation-tested by
deleting one config entry, which turned it red and named all five affected files.

**Why this one could be written when four earlier gate proposals today were deferred.** Every
deferral had the same reason: the white-alpha classes cannot be judged without knowing the ground,
so a rule would flag correct code. This class has no such ambiguity. *"`bg-primary` resolves to
nothing"* is a fact about the build, not a judgement about a surface. Tailwind can answer it, and
its answer is the same on every ground.

That is the distinction worth carrying: **gate what the toolchain can decide; promise what needs a
pair of eyes.** Four of today's classes were the second kind and this one is the first, and
conflating them is why the gate kept getting deferred with the same sentence.

### The exclusions

gate-or-promise: declared, not gated

`text-strong` (18 uses), `border-accent-text` (10), `border-primary` (2) are members of this class
and are NOT covered. The founder scoped them out, and `text-strong` for a real reason: a no-op
`text-` inherits its parent colour, so those 18 places currently look like what was reviewed and
approved. Making the utility resolve would CHANGE them, which is a different decision from fixing
them.

**They are named with their counts inside the test file itself.** A guard that quietly covers part
of a class is how a class comes to be believed closed — the neighbouring
`no-invisible-bare-color-utilities.test.ts` is proof, since its own comment names this class as out
of scope and that note has read like coverage ever since.

### A producer fix that was wrong for one member

gate-or-promise: promise

`CalibrationTool`'s button would have been made invisible in dark mode by the same config line that
fixed 25 other sites correctly.

**The promise: when fixing a class at the producer, read every member first and ask what each one
MEANT, not just what it said.** Twenty-five of these meant "the muted ink" or "the default border".
One meant "the primary action colour" and reached for the wrong word. The producer fix serves the
first group and would have silently damaged the second.

This is the counterweight to the lesson from the deck-kit build. That one said: find the producer,
do not fix instances one at a time. This one says: the producer fix is still applied to a set of
instances, and the set has to be read.

### Measuring a class three times

gate-or-promise: promise

A hand regex said 126 (mostly `text-base`, a font-size). A `resolveConfig` probe said 0, from a bug
in the probe. Neither was true.

**The promise: a checker's first clean result is evidence about the checker.** §1.7 puts it as an
empty flag list being a suspicious finding in itself. The zero cost nothing only because it was
tested against a known value — `resolved.backgroundColor.primary === undefined` and `bg-primary`
present in four files — before any number was reported. That verification took one command and it
is the only reason a wrong measurement did not become a wrong report.
