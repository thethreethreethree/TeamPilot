# BUILD

## Files

**`src/lib/api/requireSalesCoachManager.ts`** (new) — the chokepoint. Resolves auth (cookie or
Bearer), fetches `sales_coach_role`, and hands the decision to `isSalesCoachManager`. It does the
fetch that made local copies of the rule tempting, so routes consume a verdict.

**`src/app/api/coach/gamification/calibration/route.ts`** (modified) — its local `requireManager`
deleted; both call sites now use the shared helper. The comment left in its place records what the
copy was and why it was dangerous, rather than just removing it silently.

**`src/lib/coach/pitchScore/readDisputes.ts`** (new) — replays dispute and answer events into a
queue. No table, no `resolved` flag: open-ness is derived (§3.1).

Two bounded queries, not one:

```
1. newest N disputes            (kind = disputed, desc, limit ≤ 500)
2. answers for THOSE pitches    (kind = answered, .in(subject), asc, limit 1000)
```

The first draft read everything in one call with a client limit of 2,000, which PostgREST
silently caps at 1,000. The audit caught it. It is not a cosmetic bound — an answer falling
outside the window makes an **answered** dispute reappear as open, and a manager re-answers work
they already did.

**`src/app/api/coach/sales-session/pitch-score/disputes/route.ts`** (new) — GET the queue, POST an
answer. Manager-only on **both** verbs: a rep who could answer could close their own complaint.
The answer appends an event and writes no points. The pitch's company is proven on the write —
`events` is filtered by company on the way out, but a write has to prove the tenant on the way in.

`AnswerSchema` is exported so a test can pin its shape. The reason a caller cannot name the rep is
that the schema has no field for it and zod strips unknown keys — real protection, but invisible
protection, and a mutation showed the behavioural test of it passes by accident.

**`src/components/sales-coach/DisputeQueue.tsx`** (new) — the manager's view. Empty and failed are
different states and say so. The reply box states, in the UI, that replying does not change the
score, because a manager who assumes otherwise will reply and believe the rep's number moved.

**`src/app/dashboard/sales-coach/coach-assessment/page.tsx`** (modified) — mounts the queue above
the assessment. It is the one item on that page where somebody is already waiting for a reply.

**`scripts/invariant-audit.mjs`** — `requireSalesCoachManager` registered with INV18 (recognised
auth gate) and INV26 (Bearer mechanism), each with a self-test.

**Tests:** 8 helper + 17 reader + 20 route + 13 render = 58.

## The test fixtures were wrong, not the change

Replacing the calibration gate broke three of its seven existing tests. They set
`{ isAdmin: true }` with no `role`, and the shared authority keys on `role`.

The tempting reading is that the change is a regression. It is not: both auth paths derive
`isAdmin = isAdminRole(role)`, so a context with `isAdmin: true` and no role is a state production
**cannot produce**. The fixtures encoded an impossible world, which is why they failed on a change
that is behaviour-preserving. Fixed, with a note above `setAuth` explaining why the two fields
move together.

## A mock that agreed with the code

The reader's first mock ignored `.eq("kind", …)` and returned the whole fixture to every query.
Harmless with one query; it double-counted the moment there were two. A mock that answers every
query identically cannot distinguish a correct two-query read from a broken one — the
fixtures-too-clean-to-discriminate failure, relocated into the harness.
