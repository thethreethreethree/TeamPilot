-- 0196_fin_entry_date_in_period.sql
--
-- ⚠️ PROPOSAL — DRAFTED AUTONOMOUSLY, NOT YET LIVE-VERIFIED. Founder review + a run of
--    supabase/tests/verify_0196_entry_date_in_period.sql on a real DB is required before trusting it.
--    It changes core-ledger POSTING behavior (which entries get rejected), so it is applied deliberately,
--    not silently. Static reasoning only so far. (Same posture as 0190 when first written.)
--
-- FIX for finance audit finding H1 (2026-07-26, docs/audits/2026-07-26-finance-ground-up-audit.md;
-- founder queue 6a4). The closed-period gate was enforced against an entry's REFERENCED period_id, never
-- against the entry's own entry_date:
--
--   • fin_post_entry (0118:170) — the sanctioned manual-post RPC — checks only that NEW.period_id.status
--     = 'open' (the T-19 check). It never checks entry_date ∈ [period.start_date, period.end_date].
--   • fin_reverse_entry / fin_post_reversal (0118:215/248) — same gap, and it is the MORE-exercised path
--     (a reversal is how a posted entry is corrected). Both take a caller-supplied period_id + entry_date.
--
-- So a draft with entry_date INSIDE a closed period but period_id pointing at a DIFFERENT open period
-- passes T-19 and posts. Because every GL/reporting view aggregates by entry_date (0151/0164/0165), the
-- mis-dated posting silently shifts closed-period figures. Document/subledger paths are immune (they DERIVE
-- the period from the document date and require containment), so this is manual-journal + reversal only.
--
-- THE INVARIANT (§A27/A31 — enforce it structurally, don't rely on the caller): a POSTED entry's date must
-- fall within the date range of the period it posts to. One additive BEFORE-posted trigger closes BOTH
-- instances at once, independent of which RPC posts the entry.
--
-- WHY THIS SHAPE IS SAFE-BY-CONSTRUCTION:
--   • It fires ONLY on the transition INTO 'posted' — matching the existing T-19 timing. DRAFTS are never
--     checked; already-posted rows are never re-checked (they are immutable per fin_entries_immutable).
--   • It is ADDITIVE — it does not modify any SECURITY DEFINER function, so it cannot subtly break their logic.
--
-- ⚠️ BLAST RADIUS — this fires on EVERY posted-entry write, not only the 2 manual/reversal paths. I swept all
--    ~20 fin_post_system_entry callers (§A38, read each; corrects an earlier over-broad "document paths are
--    unaffected" claim). Three buckets:
--   • PROVABLY IN-PERIOD (safe): the ~14 date-derived document paths (AP bill/payment, AR invoice/receipt,
--     credit notes, expenses, reconcile, COGS, year-end, settlement) select the period WHERE the doc date is
--     between start/end; fixed-assets (0166) dates the entry at period.start_date. All satisfy the check.
--   • SHOULD BE IN-PERIOD (the check is CORRECT for them — it catches a mis-call): payroll (0167, pay_date)
--     and inventory (0180, current_date) pass a caller-supplied period; their date belongs in that period, so
--     rejecting a mismatch is the right behavior (these are in fact MORE instances of the same H1 class).
--   • THE ONE LEGITIMATE EXCEPTION: opening balances (0169) post `as_of` (a ledger-inception date) into a
--     CLIENT-SUPPLIED period with no containment check; as_of can legitimately fall at/before the first
--     period boundary. So this trigger EXEMPTS them (source LIKE 'opening_batch:%') to avoid rejecting a
--     legitimate one-time import. OPEN DECISION for the founder (accounting convention): if opening balances
--     in THIS product are always dated inside their period, drop the exemption so they're checked too.
--
-- MIGRATION OF EXISTING DATA: this trigger does NOT retroactively touch already-posted rows. If the pre-fix
-- gap already produced mis-dated postings, they persist until reversed — the verifier includes a DETECTION
-- query so you can see whether any exist before deciding whether a data cleanup is also needed.
--
-- Idempotent (A12): create or replace function + drop/create trigger.

create or replace function fin_entry_date_in_period()
returns trigger language plpgsql
security definer set search_path = public as $$
declare v_start date; v_end date;
begin
  -- Enforce only at the moment the entry becomes (or is inserted as) POSTED, and EXEMPT opening-balance
  -- entries: their as-of date is a ledger-inception convention that may legitimately fall outside the
  -- chosen period (see the BLAST-RADIUS note in the header). Every other posting path either derives the
  -- period from the date (immune) or should have its date in-period (payroll/inventory), so the check is
  -- correct for them.
  if NEW.status = 'posted'
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'posted')
     and NEW.source not like 'opening_batch:%' then
    select start_date, end_date into v_start, v_end
      from fin_periods where id = NEW.period_id;
    -- period_id is a NOT NULL FK so a row should always be found; guard defensively.
    if v_start is null then
      raise exception 'fin: period % not found — cannot verify entry_date containment', NEW.period_id;
    end if;
    if NEW.entry_date < v_start or NEW.entry_date > v_end then
      raise exception
        'fin: entry_date % is outside its period date-range (% .. %) — an entry must post to the period that CONTAINS its date, not a different open period (H1 fix, 0196)',
        NEW.entry_date, v_start, v_end;
    end if;
  end if;
  return NEW;
end $$;

-- BEFORE INSERT OR UPDATE only (never DELETE — NEW is null on delete, and a delete needs no date check).
-- Coexists with fin_entries_immutable_trg; neither mutates NEW, so firing order is irrelevant.
drop trigger if exists fin_entry_date_in_period_trg on fin_journal_entries;
create trigger fin_entry_date_in_period_trg
  before insert or update on fin_journal_entries
  for each row execute function fin_entry_date_in_period();

comment on function fin_entry_date_in_period() is
  'H1 fix (0196): a POSTED journal entry''s entry_date must fall within its period date-range. Closes the
   fin_post_entry + fin_reverse_entry gap where the close gate checked period_id status but not the date.';

-- ─── End migration 0196. ─────────────────────────────────────────────────────
