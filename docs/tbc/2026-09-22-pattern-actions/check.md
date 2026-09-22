# CHECK — the writers

## The canonical gate

```
$ npm run check
```

Exit code on its own line (A38). Result in closure.md.

`rls:audit` re-run after the route landed: **152 RLS-enabled tables, 0 without RLS, 0 tenant-pin
risks, 0 missing policies.** `pattern_events`' insert/update/delete were already allowlisted by
0258 with their reasons; this build adds a writer to the allowlisted server-side path rather than
a policy, so the audit's shape is unchanged — which is itself the thing to check, because a new
client-writable path would have shown up here.

## Mutation testing

7 mutants, every one a change that leaves the code plausible and the product wrong.

| # | Mutation | Caught by |
|---|---|---|
| 1 | rep kinds gain `coached` | 2 tests — a rep could clear their own Stalled status |
| 2 | manager kinds gain `rep_reviewed` | 2 tests — the acknowledgement tile becomes the manager's opinion |
| 3 | `ownsPattern` ignored | 5 tests — any rep could write on any pattern |
| 4 | unknown-kind check dropped | 2 tests — a bad kind reaches the CHECK as a 500 |
| 5 | route drops the company comparison | 1 test — the admin client would write into any tenant |
| 6 | route drops the `!pattern.fixed_at` guard | 1 test — re-closing moves the date and skews days-to-fix |
| 7 | `actor_id` taken from the request body | 1 test — somebody else's name on a coaching note |

**Zero survivors.** Worth noting why mutant 5 matters more here than on most routes: the pattern
is read with the service role *because the answer decides authorisation*, so RLS is deliberately
not carrying the tenant boundary and that comparison is the only thing holding it.

## The two assertions that are about numbers on other screens

**`fixed` writes `patterns.fixed_at`.** Tested directly, because an event alone leaves `statusOf`
— and therefore the Patterns pill, the Rep progress status column, the OPEN PATTERNS card and the
rep list's partition — still calling the pattern open. The test that would have caught the
original bug is *"writes fixed_at, because that is the column the resolver reads"*.

**Re-closing does not move the date.** The board averages first-seen-to-fixed across the team, so
a second close would silently restate when a rep fixed something and drag the average.

## Surface tests

20 render tests on `PatternActions`. The ones that are about a promise rather than a pixel:

- *"warns BEFORE the write that the rep will read it"* — the banner promises it at the top of the
  page; this is the same promise at the point of writing.
- *"is NOT asked to acknowledge coaching nobody gave them"* — the "1 of 0" state.
- *"shows an event WITHOUT a body nowhere in the notes"* — a marker is not a blank entry in a list
  of things people said.
- *"disables Schedule check-in and says why"* — the same sentence it carries on Rep progress.
- *"posts 'coached' and then RE-READS rather than patching its own copy"* — the status changes as
  a result of the write and the server owns that derivation.
- *"surfaces a refusal from the server instead of pretending it worked"*.

## Tests

| Suite | Count |
|---|---|
| `eventPermission.test.ts` | 21 |
| `patterns/event/route.test.ts` | 15 |
| `PatternActions.render.test.tsx` | 20 |
| **new this build** | **56** |

Plus `PatternRow.events` gaining two fields, which required a fixture helper in two existing
suites — `ev(kind, at, body)` — rather than 30 inline literals. The helper is the fix for the
thing that made the last build's wire-boundary crash easy to write: a fixture shaped by hand
drifts from the type it claims to be.

## Not opened

No image, icon or graphic asset was created, edited, moved or restyled during verification.
