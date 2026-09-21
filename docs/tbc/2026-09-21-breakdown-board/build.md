# BUILD

## Files

**`src/lib/coach/pitchScore/aggregate.ts`** — `AggregablePitch.score` narrowed from the full
`PitchScore` to `AggregableScore`, a `Pick` of the nine fields the aggregation actually reads
(established by grepping `p.score.`, not by recollection). Its 17 tests pass unchanged.

**`src/lib/coach/pitchScore/readPitchPeriod.ts`** (new) — loads a period of pitches plus their
element grades and event rows, and maps them into the aggregator's input.

Three decisions worth naming:

- **Nothing is recomputed.** Section totals come from the stored `section_points`; bonus and
  violation points come from the event rows at the values the scorer *awarded*. Re-deriving either
  corrupts every average on the board, not one pitch.
- **`rejected_bonus` rows are ignored.** They awarded nothing; counting them would credit a rep,
  on their own board, with bonuses the scorer explicitly withheld.
- **A pre-0254 pitch is excluded and counted**, never included with zeros. Zeros would drag every
  section average down and read as a coaching problem rather than as a pitch scored before the
  column existed. The count is surfaced.

**`src/app/api/coach/sales-session/pitch-score/breakdown/route.ts`** (new) — reads through the
caller's client and aggregates server-side. No role gate, deliberately: RLS on `pitches` already
decides who sees what, and a copy of that decision here is what §2.2 forbids. It defaults `repId`
to the caller, so a rep's board is theirs rather than "everything I can see".

**`src/components/sales-coach/PitchBreakdown.tsx`** (new) — the board, built to page 2 of the rep
dashboard: period switcher, qualifying count, BIGGEST OPPORTUNITY, BASE SCORE with a bar per
section, the lowest section badged, per-element hit/partial/missed on expand, BONUS POINTS and
VIOLATIONS tables, and the reconciliation footer.

**`src/app/dashboard/sales-coach/my-progress/page.tsx`** — mounts it under the arena.

**Tests:** 22 reader + 16 board.

## The runtime bug the tests caught

The first version built its query as `.select().order().limit()` and then applied `.eq("rep_id")`.

That throws: supabase-js returns a `PostgrestTransformBuilder` from `.order()`/`.limit()`, and it
has no `.eq()`. It typechecked because the injected client is an un-generic `SupabaseClient`,
which loosens the chain to `any`.

Caught because the reader's test records **which filters were applied**, not just which rows came
back — a test asserting on output would have received the fixture either way. What it would have
shipped: a rep's board showing the whole company's averages as their own, with no error anywhere.

## Two things the board deliberately does not do

**Rank by miss rate.** An 8-point element missed half the time costs four points a pitch; a
2-point element missed entirely costs two. Rate-ranking sends the rep after the smaller prize.

**Show a gap under a tenth of a point.** A rep doing well must not be handed a target that cannot
move.
