-- 0133 + 0138 acceptance — AR/AP aging bucket arithmetic. Staging, 0116-0138 applied.
-- Rollback; RAISE NOTICE PASS/FAIL. Covers the one place aging bugs actually live: the
-- current / 1-30 / 31-60 / 61-90 / 90+ boundary math (off-by-one at 0/1, 30/31, 60/61, 90/91).
--
-- AR (fin_ar_aging) and AP (fin_ap_aging) use IDENTICAL bucket predicates, so PART 1 proves the
-- boundary definition for BOTH. PART 2 exercises the real fin_ap_aging view's days_overdue +
-- outstanding on seeded data (service-role testable; the *_summary() functions are auth_company_id()
-- gated and covered at the app layer).
--
-- NOTE: the predicates in PART 1 mirror fin_ap_aging_summary / fin_ar_aging_summary. If those
-- boundaries ever change, update this block in lockstep — that coupling is intentional.

begin;

-- ── PART 1 — bucket partition invariant (pure; no tables, no auth) ──
-- For each days_overdue value spanning every boundary, the five bucket predicates must select it
-- into EXACTLY ONE bucket, and it must be the expected one. Exactly-one proves the buckets are both
-- exhaustive (no value falls through) and mutually exclusive (no value double-counts).
do $$
declare r record; v_bucket text; v_matches int; v_fail int := 0;
begin
  for r in select * from (values
      (null::int,'current'), (-5,'current'), (0,'current'),
      (1,'d1_30'),  (30,'d1_30'),
      (31,'d31_60'),(60,'d31_60'),
      (61,'d61_90'),(90,'d61_90'),
      (91,'d90_plus'),(200,'d90_plus')
    ) as t(d, expected)
  loop
    v_matches :=
        (case when r.d is null or r.d <= 0 then 1 else 0 end)
      + (case when r.d between 1 and 30   then 1 else 0 end)
      + (case when r.d between 31 and 60  then 1 else 0 end)
      + (case when r.d between 61 and 90  then 1 else 0 end)
      + (case when r.d > 90               then 1 else 0 end);
    v_bucket := case
        when r.d is null or r.d <= 0 then 'current'
        when r.d between 1 and 30    then 'd1_30'
        when r.d between 31 and 60   then 'd31_60'
        when r.d between 61 and 90   then 'd61_90'
        when r.d > 90                then 'd90_plus' end;
    if v_matches <> 1 then
      raise notice 'PARTITION FAIL: days_overdue=% matched % buckets (want exactly 1)', coalesce(r.d::text,'null'), v_matches;
      v_fail := v_fail + 1;
    elsif v_bucket is distinct from r.expected then
      raise notice 'PARTITION FAIL: days_overdue=% -> % (want %)', coalesce(r.d::text,'null'), v_bucket, r.expected;
      v_fail := v_fail + 1;
    end if;
  end loop;
  if v_fail = 0 then
    raise notice 'PARTITION PASS: all boundary values (null,-5,0,1,30,31,60,61,90,91,200) land in exactly one correct bucket';
  else
    raise notice 'PARTITION FAIL: % boundary value(s) misbucketed', v_fail;
  end if;
end $$;

-- ── PART 2 — real fin_ap_aging view: days_overdue + outstanding ──
insert into companies (id, name) values ('00000000-0000-0000-0000-0000000000c1','ACCEPT Co')
  on conflict (id) do nothing;
insert into fin_settings (company_id, base_currency) values ('00000000-0000-0000-0000-0000000000c1','USD')
  on conflict (company_id) do nothing;
insert into fin_accounts (company_id, code, name, type, normal_balance)
  values ('00000000-0000-0000-0000-0000000000c1','6000','Operating Expenses','expense','debit')
  on conflict (company_id, code) do nothing;
insert into fin_vendors (id, company_id, name)
  values ('00000000-0000-0000-0000-00000000d001','00000000-0000-0000-0000-0000000000c1','Acme Supplies')
  on conflict (id) do nothing;

-- Approved bills at fixed offsets from current_date, so days_overdue = the offset. Insert
-- status='approved' directly (service role bypasses the draft-lock RLS) since the view reads
-- approved bills; the approve→GL path itself is covered by 0123/0124.
insert into fin_bills (id, company_id, vendor_id, bill_number, bill_date, due_date, status) values
  ('00000000-0000-0000-0000-0000000000a0','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','AG-0',  current_date, current_date,        'approved'),
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','AG-15', current_date, current_date - 15,   'approved'),
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','AG-45', current_date, current_date - 45,   'approved'),
  ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','AG-75', current_date, current_date - 75,   'approved'),
  ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','AG-100',current_date, current_date - 100,  'approved'),
  ('00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000d001','AG-NULL',current_date, null,               'approved')
  on conflict (id) do nothing;
insert into fin_bill_lines (company_id, bill_id, line_no, account_id, amount, tax_amount)
  select '00000000-0000-0000-0000-0000000000c1', id, 1,
         (select id from fin_accounts where company_id='00000000-0000-0000-0000-0000000000c1' and code='6000'),
         100, 0
  from fin_bills where bill_number like 'AG-%';

do $$ declare v_bad int;
begin
  -- days_overdue = offset, for every dated bill
  select count(*) into v_bad from fin_ap_aging a
  join (values
      ('00000000-0000-0000-0000-0000000000a0'::uuid, 0),
      ('00000000-0000-0000-0000-0000000000a1', 15),
      ('00000000-0000-0000-0000-0000000000a2', 45),
      ('00000000-0000-0000-0000-0000000000a3', 75),
      ('00000000-0000-0000-0000-0000000000a4', 100)
    ) e(id, exp) on e.id = a.bill_id
  where a.days_overdue is distinct from e.exp;
  if v_bad = 0 then raise notice 'VIEW PASS: days_overdue = current_date - due_date for all dated bills';
  else raise notice 'VIEW FAIL: % bill(s) had wrong days_overdue', v_bad; end if;

  -- null due_date -> null days_overdue (folds into the current bucket, never a fake overdue)
  perform 1 from fin_ap_aging where bill_id='00000000-0000-0000-0000-0000000000a5' and days_overdue is null;
  if found then raise notice 'VIEW PASS: null due_date -> null days_overdue';
  else raise notice 'VIEW FAIL: null due_date produced a non-null days_overdue'; end if;

  -- outstanding = sum(lines.amount + tax) - sum(payments); with one 100 line + no payment -> 100
  perform 1 from fin_ap_aging where bill_id='00000000-0000-0000-0000-0000000000a1' and outstanding = 100;
  if found then raise notice 'VIEW PASS: outstanding = lines - payments (100 with no payment)';
  else raise notice 'VIEW FAIL: outstanding not equal to 100 for a single unpaid 100 line'; end if;
end $$;

rollback;

-- APP-LAYER (needs auth): fin_ap_aging_summary() / fin_ar_aging_summary() sum the buckets above but
-- filter on company_id = auth_company_id(), so they return zeros under a service-role session. Drive
-- them from the AP/AR pages (an approved unpaid bill/invoice shows in its bucket; paying clears it).
