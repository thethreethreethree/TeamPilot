-- 0175 — PHASE 5: CASH-FLOW FORECAST (committed obligations + the stated gap).
--
-- Founder-confirmed 2026-07-14: Option A — forecast from COMMITTED obligations, and show the uncommitted
-- gap explicitly. Option B (extrapolate the last N months) was rejected, and the reason matters more than
-- the schema below:
--
-- ── WHY WE DO NOT EXTRAPOLATE ────────────────────────────────────────────────────────────────
--
-- A trend-fitted forecast is smooth, confident and plausible. It is RIGHT most months, because most months
-- resemble the last one. It is CATASTROPHICALLY WRONG exactly when it matters — when something changed,
-- which is the only time anyone urgently reads a cash forecast.
--
-- A company that has just lost its largest customer opens a trend forecast that is still projecting that
-- customer's revenue, drawn from the average of the twelve months in which they were still paying. There is
-- no signal at the moment of failure: the number looks exactly as authoritative as it did last month. And
-- the founder makes a hiring decision against a line drawn from a past that no longer exists.
--
-- That is §3.4 applied to money: a forecast claiming knowledge it does not have is a lie that balances.
--
-- ── SO EVERY LINE HERE TRACES TO A DOCUMENT A HUMAN CREATED ──────────────────────────────────
--
--   IN : unpaid invoices (sent, net of credit notes), by due date
--   OUT: approved unpaid bills, by due date · scheduled payments · recurring bills (next occurrences)
--   NOT INCLUDED: depreciation (not a cash flow), and revenue you have not invoiced yet.
--
-- The forecast will therefore look PESSIMISTIC to a growing company, and that is not a defect to correct —
-- it is the honest shape of what is actually known. The correction is to SAY SO: fin_cash_gap states, in
-- one number, how much you must win from business not yet invoiced. That converts a forecast into a
-- TARGET, which is more useful than an average and cannot quietly mislead.
--
-- Idempotent (§A12). NOT VERIFIED against a live database. BUILT, not TESTED.

-- ─── Today's actual cash, read from the ledger ────────────────────────
-- The forecast's starting point is a FACT, never an assumption or a cached figure. It reads the same
-- posted ledger the balance sheet reads, so the forecast and the balance sheet can never disagree about
-- where the company stands today — and if they ever did, the forecast would be worthless from day zero.
create or replace view fin_cash_today with (security_invoker = true) as
  select a.company_id,
         coalesce(sum(l.base_debit - l.base_credit), 0)::numeric(19,4) as cash_now
    from fin_cash_accounts a
    left join fin_journal_lines   l on l.account_id = a.id
    left join fin_journal_entries e on e.id = l.entry_id and e.status = 'posted'
   group by a.company_id;

-- ─── Every future cash movement we actually KNOW about ────────────────
create or replace view fin_cash_commitments with (security_invoker = true) as
  -- Money owed TO us: invoices sent and not fully paid. fin_invoice_summary already nets off issued credit
  -- notes (0143), so a credited invoice does not sit in the forecast as inflow that will never arrive.
  select i.company_id,
         'inflow'::text                              as direction,
         coalesce(i.due_date, i.invoice_date)        as expected_on,
         (i.total - i.paid)::numeric(19,4)           as amount,
         'invoice'::text                             as source_type,
         i.invoice_number                            as source_ref
    from fin_invoice_summary i
   where i.status = 'sent'
     and (i.total - i.paid) > 0

  union all

  -- Money we owe: bills approved but not fully paid.
  select b.company_id,
         'outflow',
         coalesce(b.due_date, b.bill_date),
         (b.total - b.paid)::numeric(19,4),
         'bill',
         b.bill_number
    from fin_bill_summary b
   where b.status = 'approved'
     and (b.total - b.paid) > 0

  union all

  -- Payments someone has explicitly scheduled (0158).
  -- NOTE: a scheduled payment settles a bill that is ALSO in the branch above. Counting both would
  -- DOUBLE the outflow — the single most likely bug in this whole view, and it would make the company
  -- look like it runs out of money weeks before it does. So the bill branch excludes any bill with a
  -- live schedule, below.
  select s.company_id,
         'outflow',
         s.scheduled_date,
         s.amount,
         'scheduled_payment',
         'Scheduled payment'
    from fin_payment_schedules s
   where s.status = 'scheduled'

  union all

  -- Recurring bills (0140): the NEXT occurrence only. Projecting twelve months of rent forward would be
  -- extrapolation wearing a commitment's clothes — we know the next one is due; we do not know the
  -- landlord will still be the landlord in November.
  select r.company_id,
         'outflow',
         r.next_date,
         (r.amount + r.tax_amount)::numeric(19,4),
         'recurring',
         r.memo
    from fin_recurring_bills r
   where r.is_active;

-- The bill branch above must not double-count a bill that already has a live schedule.
create or replace view fin_cash_commitments_net with (security_invoker = true) as
  select c.*
    from fin_cash_commitments c
   where c.source_type <> 'bill'
      or not exists (
        select 1
          from fin_payment_schedules s
          join fin_bill_summary b on b.id = s.bill_id
         where s.status = 'scheduled'
           and b.company_id   = c.company_id
           and b.bill_number  = c.source_ref
      );

-- ─── The forecast: day by day, from today's real cash ─────────────────
create or replace function fin_cash_forecast(p_days int default 90)
returns table (
  day           date,
  inflow        numeric(19,4),
  outflow       numeric(19,4),
  closing_cash  numeric(19,4),
  is_negative   boolean
)
language plpgsql stable security definer set search_path = public as $$
declare v_co uuid; v_cash numeric(19,4);
begin
  v_co := auth_company_id();
  if not fin_can_view() then
    raise exception 'Not authorized to view the cash forecast';
  end if;
  if p_days < 1 or p_days > 365 then
    raise exception 'The forecast horizon must be between 1 and 365 days';
  end if;

  select coalesce(cash_now, 0) into v_cash from fin_cash_today where company_id = v_co;
  v_cash := coalesce(v_cash, 0);

  return query
  with days as (
    select generate_series(current_date, current_date + (p_days - 1), interval '1 day')::date as d
  ),
  moves as (
    -- An obligation whose date has already PASSED and is still unpaid has NOT gone away. It is pulled to
    -- today rather than dropped. An overdue bill is more urgent than a future one, and a forecast that
    -- silently discarded it would show the company holding cash it does not have.
    select greatest(c.expected_on, current_date) as d,
           sum(case when c.direction = 'inflow'  then c.amount else 0 end) as inn,
           sum(case when c.direction = 'outflow' then c.amount else 0 end) as outt
      from fin_cash_commitments_net c
     where c.company_id  = v_co
       and c.expected_on <= current_date + (p_days - 1)
     group by 1
  ),
  daily as (
    select d.d,
           coalesce(m.inn,  0) as inn,
           coalesce(m.outt, 0) as outt
      from days d
      left join moves m on m.d = d.d
  )
  -- The running balance is a plain cumulative window: today's cash, plus every net movement up to and
  -- including this day. Written the obvious way on purpose — a balance nobody can read is a balance nobody
  -- can check, and this is the number a founder will make a hiring decision against.
  select dd.d,
         dd.inn::numeric(19,4),
         dd.outt::numeric(19,4),
         (v_cash + sum(dd.inn - dd.outt) over (order by dd.d
                                               rows between unbounded preceding and current row)
         )::numeric(19,4) as closing_cash,
         (v_cash + sum(dd.inn - dd.outt) over (order by dd.d
                                               rows between unbounded preceding and current row)
         ) < 0 as is_negative
    from daily dd
   order by dd.d;
end $$;

-- ─── The gap: what you must win that you have not yet invoiced ────────
-- THIS IS THE HONEST HALF OF THE FEATURE. The forecast above knows only what is committed, so for a growing
-- company it looks alarming. Rather than quietly padding it with an assumed trend, we state the shortfall
-- as a number the founder can aim at.
create or replace view fin_cash_gap with (security_invoker = true) as
  with horizon as (
    select c.company_id,
           sum(case when c.direction = 'inflow'  then c.amount else 0 end) as committed_in,
           sum(case when c.direction = 'outflow' then c.amount else 0 end) as committed_out
      from fin_cash_commitments_net c
     where c.expected_on <= current_date + 90
     group by c.company_id
  )
  select t.company_id,
         t.cash_now,
         coalesce(h.committed_in, 0)  as committed_in,
         coalesce(h.committed_out, 0) as committed_out,
         -- Positive = you must win this much from business not yet invoiced, in the next 90 days, or you
         -- run out. Negative = committed cash covers committed obligations.
         (coalesce(h.committed_out, 0) - coalesce(h.committed_in, 0) - t.cash_now)::numeric(19,4) as gap
    from fin_cash_today t
    left join horizon h on h.company_id = t.company_id;
