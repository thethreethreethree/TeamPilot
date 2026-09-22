-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- 0264 — the attention queue stops going quiet after fifty reviews
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- THE DEFECT, and it is not a performance concern dressed up as one.
--
-- `readReviewFlags` (shipped 2026-09-22) reads the fifty most recent violation events and THEN
-- drops the ones a manager has already answered:
--
--     .order("id", desc).limit(50)        ← the budget is spent here
--     .filter(r => !reviewed.has(...))    ← and the reviewed rows have already spent it
--
-- So the queue does not show "the fifty oldest unreviewed flags". It shows "whichever of the
-- fifty most recent flags are unreviewed". Once a company accumulates fifty flagged events, an
-- older unreviewed one can never appear again. Review all fifty and the card renders EMPTY —
-- while the flag is still sitting there unanswered.
--
-- That is failure mode #1 from this feature's own think doc, arriving through the back door:
--
--     "A failed read rendered as an empty queue. On this card that reads as reassurance:
--      'nobody has been rude this week' when the truth is 'nobody looked'."
--
-- The read was hardened against a failed query returning `[]`. It was not hardened against a
-- SUCCESSFUL query returning `[]` for the same reason. The rude-or-dismissive flag is the one
-- deduction the rubric refuses to let a machine finalise; a silent ceiling on how many of them
-- can ever reach a human defeats the clause the feature exists to satisfy.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHY A VIEW AND NOT A BIGGER NUMBER
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- Raising 50 to 500 moves the cliff; it does not remove it, and it makes the failure rarer and
-- therefore harder to ever find again (A30: a gate must be precise or not exist — the same
-- applies to a bound). The correct fix is that the LIMIT must apply to unreviewed rows, which
-- means the anti-join has to happen in the database, before the cut.
--
-- PostgREST cannot express `not exists` across two tables in a query string. A view can, and a
-- view is also the thing that makes the count honest: the same request returns both the page and
-- the exact total, so a bounded list can say it is bounded instead of implying completeness.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- WHAT THIS VIEW DELIBERATELY DOES NOT KNOW
-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- It does not filter to the violations that flag for review. That set is derived in TypeScript
-- from `rubric.ts` (`flagsForReview`), and a second copy in SQL would be exactly the §2.2 drift:
-- a violation gaining the flag in the rubric and not in this file, with every gate green. The
-- view holds the part SQL is better at — "has a human answered this" — and nothing else.
--
-- It also does not filter by company. RLS does that, through `security_invoker`, and the caller
-- still passes `.eq("company_id", …)` so the plan is indexed rather than filtered after the fact.
--
-- Re-runnable by construction (A12): `create or replace` and `if not exists`.

create or replace view unreviewed_violation_flags as
select
  e.id,
  e.company_id,
  e.pitch_id,
  e.item_id,
  e.points,
  e.timestamp_s,
  e.evidence,
  s.rep_id,
  s.recorded_at
from pitch_score_events e
join pitch_scores s on s.id = e.pitch_id
where e.type = 'violation'
  and not exists (
    select 1
    from pitch_score_overrides o
    where o.pitch_id = e.pitch_id
      and o.item_id  = e.item_id
      and o.item_type = 'violation'
  );

-- RLS OF THE UNDERLYING TABLES, APPLIED AS THE CALLER. Without this a view runs with its owner's
-- privileges and becomes a hole straight through the tenant boundary it reads across. The literal
-- `= true` rather than `= on` is the repo convention AND what `rls:audit` matches statically —
-- 0216 set it with `on`, behaved correctly, and the static auditor could not see it (0217).
alter view unreviewed_violation_flags set (security_invoker = true);

-- The anti-join's lookup. The existing index is (pitch_id, created_at desc), which serves the
-- pitch's own override history; this one serves "is there an override for THIS item".
create index if not exists pitch_score_overrides_item_idx
  on pitch_score_overrides (pitch_id, item_id, item_type);

comment on view unreviewed_violation_flags is
  'Violation events with no manager override recorded for the same (pitch, item). "Reviewed" is the presence of an override row, either answer — see reviewFlags.ts. Exists so a LIMIT applies to UNREVIEWED rows: filtering after the cut let an older unanswered flag fall permanently off the end (0264).';
