-- 0208 — coaching_transcript_segments: dedup + unique(session_id, seq) to make finalize idempotent.
--
-- ROOT CAUSE (confirmed live 2026-08-06). coaching_transcript_segments had NO unique(session_id, seq)
-- constraint (only the PK on id). The client finalize guard (finalizedRef in useLiveCoaching) prevents a
-- double-finalize only WITHIN one hook instance; a hook REMOUNT / retry with the same session_id re-fired
-- finalize, re-appending the whole transcript with seq 0..N. The duplicate (session_id, seq) rows then
-- INTERLEAVE on read (getSessionTranscript orders by seq) into a "Frankenstein" transcript, which fed wrong
-- dissects / after-pitch summaries. 132 duplicate rows accrued across 13 sessions (newest 2026-08-05).
--
-- FIX (founder-approved 2026-08-06 — "unique constraint + idempotent finalize"):
--   1. Dedup existing duplicates, keeping the EARLIEST segment per (session_id, seq) — first-take-wins.
--   2. Add unique(session_id, seq) so a re-finalize's inserts CONFLICT instead of duplicating.
-- The finalize insert path (appendTranscriptSegment) is changed in the same PR to treat a 23505 unique
-- violation as an idempotent no-op, so a remount/retry is silent and safe.
--
-- §3.1 NOTE. This table is append-only (coaching_transcript_segments_no_delete / _no_update rules, 0070).
-- Removing DUPLICATE rows is a corruption-correction that RESTORES the true recorded history — it is not a
-- history rewrite. It requires temporarily lifting the no_delete rule; the rule is RE-CREATED at the end of
-- this same migration, so the table returns to append-only and the verify:live append-only guard still
-- passes (db:apply auto-runs it). The no_update rule is left untouched throughout.
-- (db-apply.mjs wraps each migration in its own begin/commit — no explicit transaction here, or its inner
-- commit would break the --verify dry-run's rollback.)

-- 1. Temporarily lift the append-only DELETE block for this one-time corruption-correction.
drop rule coaching_transcript_segments_no_delete on public.coaching_transcript_segments;

-- 2. Dedup: keep the earliest created_at per (session_id, seq); delete the later duplicate(s).
delete from public.coaching_transcript_segments a
using public.coaching_transcript_segments b
where a.session_id = b.session_id
  and a.seq = b.seq
  and a.created_at > b.created_at;

-- 2b. Tie-break safety: if any (session_id, seq) still has >1 row with IDENTICAL created_at (verified 0 live
--     2026-08-06, but be defensive so the constraint below cannot fail), keep the lowest id.
delete from public.coaching_transcript_segments a
using public.coaching_transcript_segments b
where a.session_id = b.session_id
  and a.seq = b.seq
  and a.created_at = b.created_at
  and a.id > b.id;

-- 3. Prevent recurrence: a re-finalize's duplicate (session_id, seq) insert now raises 23505 (which the
--    finalize path catches as an idempotent no-op).
alter table public.coaching_transcript_segments
  add constraint coaching_transcript_segments_session_seq_unique unique (session_id, seq);

-- 4. Restore the append-only DELETE block (identical to 0070) — the table is append-only again.
create rule coaching_transcript_segments_no_delete as
  on delete to public.coaching_transcript_segments do instead nothing;
