# CHECK — the rude-flag review queue

## The canonical gate

```
$ npm run check
```

ELEVEN steps at the time of this run — I wrote "twelve" here and in four other build records, over a list of eleven, all session. Corrected 2026-09-22 when adding `sql:harness` made it twelve for real; a number that becomes true later was still wrong when written. `typecheck && lint && theme:audit && rls:audit && invariant:audit &&
reachability:audit && writer:audit && enum:audit && migration:audit && tbc && test`. Exit code on
its own line (A38). Result in closure.md.

**No migration in this build**, so nothing new for `migration:audit` or `rls:audit` to judge — and
that is itself the check worth naming: a feature that needed a new table would have shown up
there, and this one did not, because both answers were already expressible through
`apply_pitch_score_override`.

## Tests

| Suite | Count |
|---|---|
| `ReviewFlagQueue.render.test.tsx` | 17 |
| `CoachAssessmentBoard.render.test.tsx` | 21 (1 replaced, 2 added) |
| **new this build** | **19** |

## The test that was deleted, and what replaced it

The board suite carried:

```ts
it("names what is NOT in Needs-your-attention rather than showing an empty list", …)
  expect(await screen.findByText(/Rude-or-dismissive flags are not wired/i))
```

**A test whose entire content was that a feature did not exist.** It is now wired, so it is
replaced by the two facts it was standing in for:

- *"says nothing is outstanding when the flag read came back EMPTY"*
- *"does NOT render a failed flag read as an empty queue"*

plus a third asserting a real flag renders with the rep, the cost and the evidence. That is the
second time today an unbuilt-message test has been replaced rather than deleted — the first was
Rep progress — and the pattern is worth naming: **a test that asserts an absence has to be
converted, not removed, or the thing it was quietly protecting goes unasserted.**

## What the tests pin, and why each one

| Assertion | The failure it prevents |
|---|---|
| `flags === null` renders "could not be read" | On this card an empty queue reads as *nobody has been rude this week* when the truth is *nobody looked* |
| `flags === []` renders "none awaiting review" | The opposite error — a real finding shown as a failure |
| the evidence string is rendered | A card offering *Remove* without what the scorer heard asks for a rubber stamp |
| `at 5:12` shown, `at 0:00` never | A null timestamp coerced to zero is a specific claim about the opening |
| both answers disabled until a reason is typed | An override without a reason is indistinguishable from a manager editing a number they disliked |
| Remove posts `removed` **to the existing override route** | A second write path to a table that already has one (§2.2) |
| Confirm posts `awarded` | The no-op that is still a record — a flag going quiet tells the rep nothing |
| `onReviewed` fires on either answer | Removing rescores the pitch; the board must re-read |
| a refusal is surfaced, and does **not** re-read | Pretending a rejected write worked |
| `REVIEW_FLAG_IDS` has `viol.rude` and **not** the other four | A hard-coded list that silently misses a future `flagsForReview` |

## The crash the existing tests caught

Six board tests went red with `Cannot read properties of undefined (reading 'length')` the moment
`ReviewFlagQueue` mounted against a fixture without the new field.

**Third time today.** `events` and `comparison` on `PatternRow` did the same thing earlier, and I
wrote the defence for both. A browser holds its bundle across a deploy, so a client compiled
against today's fields is routinely handed yesterday's JSON — which means the fixture that had no
`reviewFlags` was not a bad fixture, it was a valid response.

Fixed at the component (`if (!flags)`, type widened to include `undefined`) rather than at the
fixture, because fixing the fixture would have left the real case open.

**Neither typecheck nor lint nor any of the ten audits can see this class.** It is a value the
type system was promised and the network did not deliver. The only thing that catches it is a test
that mounts the component against a response shape it was not compiled for — which, in this case,
was an accident.

## Not opened

No image, icon or graphic asset was created, edited, moved or restyled during verification.
