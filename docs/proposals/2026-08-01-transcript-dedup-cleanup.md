# Proposal — coaching_transcript_segments dedup + unique constraint

> **Status: PROPOSAL for founder review. Nothing here has been applied.** It touches append-only
> production data, so it is deliberately a draft, not a migration file. Review, adjust, then promote
> to `supabase/migrations/` and apply via `npm run db:apply`.

## Why

The transcript-labeling double-click bug (client side fixed in `5d8be3ac`) appended the whole
transcript multiple times for a session when the "which voice is you?" button was clicked more than
once. `appendTranscriptSegment` is a plain `insert` with no `unique (session_id, seq)`, and
`coaching_transcript_segments` (migration 0070) forbids UPDATE + DELETE via rules — so the duplicates
accumulated and cannot be cleaned up through the normal API.

**Confirmed live impact (read-only count, 2026-08-01):** 928 total segments · 97 duplicate
`(session_id, seq)` groups · **128 excess rows (13.8% of all transcript data)** · **12 of 61 sessions
affected**. Those 12 sessions' after-pitch reviews + KPI scores were computed on transcripts inflated
3–5×.

## Affected sessions (excess rows = duplicate rows to remove)

| session_id | current rows | excess |
|---|---|---|
| ab7dfff4-42b1-41c5-a57d-41d7692e02ac | 30 | 42 |
| dc9c38ea-a79a-41cf-aa36-e411fb3fb14e | 19 | 25 |
| 660e8567-3328-4cb4-8294-cd866f0ca5c5 | 25 | 17 |
| 00eb3111-cb0f-4c31-b64f-2eca552418dd | 7 | 13 |
| 85b9697b-4f11-4d47-bdbd-ebf82addd8e9 | 36 | 11 |
| c424f504-a59f-4bf7-befe-e01b7791f0f6 | 28 | 7 |
| 7c26487b-16f3-4d24-91a4-5d2334665661 | 14 | 4 |
| a4898838-8ef7-4ec5-bbf1-67313e8a9bbd | 9 | 4 |
| 2eb09e7f-7fb6-4f20-829e-a154f8dcb36d | 3 | 2 |
| f50c3a76-d4b3-41d2-b312-fb9871a10aa2 | 4 | 1 |
| 50d79e20-20ac-4515-a9b7-b341771f50db | 13 | 1 |
| 24d0afee-b1a8-4873-ad5f-d97ce214c271 | 7 | 1 |

The duplicates are byte-identical (same `text`, same `seq`) — the bug re-appended the same rows — so
keeping any single copy of each `(session_id, seq)` is lossless.

## Step 0 — DRY RUN (run first, expect 128)

Count exactly what the dedup DELETE below would remove, without deleting anything:

```sql
select count(*) as would_delete from (
  select a.ctid
  from coaching_transcript_segments a
  join coaching_transcript_segments b
    on a.session_id = b.session_id and a.seq = b.seq
  where a.ctid > b.ctid
) x;   -- expect 128
```

## Step 1 — the migration (single transaction)

```sql
begin;

-- 1a. The table forbids DELETE via a rule (0070). Drop it for the cleanup.
drop rule if exists coaching_transcript_segments_no_delete on coaching_transcript_segments;

-- 1b. Dedup: keep one row per (session_id, seq), delete the rest.
--     ctid is stable within this transaction (no VACUUM runs mid-tx). The
--     kept row is arbitrary but the copies are identical, so it's lossless.
delete from coaching_transcript_segments a
using coaching_transcript_segments b
where a.session_id = b.session_id
  and a.seq = b.seq
  and a.ctid > b.ctid;
-- Expect: 128 rows deleted.

-- 1c. Re-add the no-delete rule (restore the append-only immutability).
create rule coaching_transcript_segments_no_delete as
  on delete to coaching_transcript_segments do instead nothing;

-- 1d. The durable fix: reject any future double-append at the DB.
--     appendTranscriptSegment already treats a null return as "not appended",
--     so a rejected duplicate insert degrades cleanly (no client crash).
alter table coaching_transcript_segments
  add constraint coaching_transcript_segments_session_seq_uq unique (session_id, seq);

commit;
```

## Step 2 — verify (after commit)

```sql
-- Expect 0 dup groups:
select count(*) from (
  select 1 from coaching_transcript_segments group by session_id, seq having count(*) > 1
) x;
-- Expect the constraint to exist:
select conname from pg_constraint where conname = 'coaching_transcript_segments_session_seq_uq';
```

Then add a live-invariant check to `scripts/verify-invariants-live.mjs` asserting the constraint
exists (so it can't silently regress).

## Step 3 — SEPARATE decision: re-score the 12 sessions

Those 12 sessions' after-pitch summaries + KPI numbers ran on the inflated transcripts. After the
dedup, the stored transcript is correct, but the *derived* review/scores are stale. Options for you:
- **Re-generate** the after-pitch summary for each (the `/after-pitch` route regenerates from the
  transcript) and recompute their KPI contribution. Cleanest.
- **Leave as-is** if the pilot cohort's historical numbers aren't load-bearing — but flag it so the
  numbers aren't trusted for the pilot proof.

I can script a one-shot re-generation over these 12 session ids on your go.

## Notes / risks

- The whole thing is one transaction — if any step fails it rolls back, leaving the table exactly as
  now (still duplicated, but nothing broken).
- Dropping + re-adding the no-delete rule inside the transaction means there is **no window** where a
  concurrent client DELETE could slip through (the rule is absent only within this uncommitted tx).
- If new duplicates land between the read-only count and the apply (unlikely now the client latch
  ships, but possible from an old open tab), the `would_delete` count just changes; the dedup is
  self-adjusting (it removes whatever duplicates exist at apply time).
