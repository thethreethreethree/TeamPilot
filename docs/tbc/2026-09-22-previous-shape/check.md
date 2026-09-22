# CHECK — the previous-shape harness

## The canonical gate

```
$ npm run check
```

Twelve steps. Exit code on its own line (A38). Result in closure.md.

## The probe, which is the whole verification

A harness that cannot fail is a green light with extra steps — the same reason both audits built
today were probed. This one was probed twice.

**1. A planted throw**, inside the test file itself:

```tsx
const Boom = ({ xs }: { xs: number[] | undefined }) => <div>{xs!.length}</div>;
expect(result.threw).toMatch(/length/);
```

Proves the detector detects.

**2. Both real hardenings reverted** to their pre-fix form — `eventsOf()` back to `p.events`, and
`if (!flags)` back to `if (flags === null)`:

```
× survives every field added on 2026-09-22
AssertionError: these surfaces threw when a field was missing:
  · PatternRow.events — Cannot read properties of undefined (reading 'filter')
  · reviewFlags — Cannot read properties of undefined (reading 'length')
```

It reproduces **both original crashes by name, with their exact error messages**. Restored; back
to green.

That second probe is the one that matters. The first proves the harness can report a throw; the
second proves it reports *these* throws, which is a different claim.

## What the failure message does

The assertion is on an array of `{ field, threw }` rather than one boolean per case, so a failure
names every surface that broke in one run:

```
these surfaces threw when a field was missing:
  · PatternRow.events — Cannot read properties of undefined (reading 'filter')
  · reviewFlags — Cannot read properties of undefined (reading 'length')
```

A per-case `expect` would have stopped at the first and hidden the second — which is exactly the
situation this file exists for, since the three real crashes came in a batch.

## Tests

| | |
|---|---|
| the four real cases, in one assertion | 1 |
| the harness reports a throw | 1 |
| the harness does not mutate its input | 1 |
| **new this build** | **3** |

Three tests covering four surfaces and two properties of the tool itself. Small on purpose: this
is a harness, and most of its value is in the cases that get added to it later.

## Not opened

No image, icon or graphic asset was created, edited, moved or restyled during verification.
