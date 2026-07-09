-- 0105 — resolutions: close decided_by author-spoof (0103/0104 class) AND company_id/problem_id
--        push-out (0095/0101/0102 class) — both documented classes missed this one table.
--
-- Why
-- ───
-- `resolutions` is central: it feeds §3.1 (close_problem emits problem.resolved; 0100 emits
-- durability events), the brain (learn.ts reads held/reopened/partial resolutions), and §3.5
-- durability metrics. Its authz has gaps in TWO classes swept elsewhere this window:
--
-- 1. AUTHOR-SPOOF (the class 0103 opened, 0104 extended to messages). `decided_by` (→ auth.users)
--    records WHO decided the resolution. The `resolutions - all` policy (0005:73) is
--    `for all using(company) with check(company)` — no decided_by constraint — so a member can:
--      • direct-insert a resolution with `decided_by = <victim>` (fabricate a decision attributed
--        to a colleague), or
--      • UPDATE an existing resolution's `decided_by` to a victim.
--    close_problem() (0005:163, SECURITY INVOKER) hard-codes `decided_by := auth.uid()`, so the
--    legit path is self — but the policy allowed the spoof. Pollutes the brain + attributes a
--    fabricated decision to a victim.
--
-- 2. TENANT-KEY PUSH-OUT (the class 0095 named, 0101/0102 extended). The immutability trigger
--    check_resolution_immutability() (0005:50) freezes only action_taken / reasoning / decided_at.
--    It leaves `company_id` AND `problem_id` MUTABLE. With `with check(company)` on the NEW row
--    checking only that NEW.company_id = the caller's, a member could change `company_id` to a
--    known FOREIGN company (cross-tenant relocation) or re-point `problem_id`. Same shape as 0095.
--
-- Why the fix must SPLIT the `for all` policy (§1.5 ripple-trace)
-- ─────────────────────────────────────────────────────────────
-- The decided_by constraint can only apply to INSERT, NOT update: a manager legitimately REVIEWS
-- a REP's resolution (resolutions/route.ts:80 sets reviewer/observed_outcome/durability), updating
-- a row whose decided_by is the rep, not the manager. A `for all` with-check of
-- `decided_by = auth.uid()` would reject that legit review. So split into per-command policies:
--   • select — using(company)            (unchanged surface)
--   • insert — check(company AND decided_by self-or-null)   ← closes the insert-side spoof
--   • update — using(company) check(company)                 ← decided_by/company_id/problem_id
--                                                              frozen by the extended trigger below
-- (DELETE intentionally gets NO policy: 0094's `do instead nothing` rule already no-ops deletes;
--  omitting a delete policy is defense-in-depth — RLS default-deny — and changes no behavior.)
--
-- And extend check_resolution_immutability() to ALSO freeze decided_by / company_id / problem_id
-- — set at creation, never legitimately changed. This closes the UPDATE-side decided_by spoof AND
-- the company_id/problem_id push-out in one place, while the review fields (reviewer /
-- observed_outcome / durability / reviewed_at) stay mutable. Triggers fire on service-role writes
-- too, but the durability sweep + 0100 trigger only touch the review fields, so nothing breaks.
--
-- Verified safe (§0): close_problem inserts decided_by = auth.uid() (passes insert check); the
-- review endpoint + durability sweep never change decided_by/company_id/problem_id (pass the
-- frozen trigger); service-role + DEFINER bypass RLS but still hit the trigger, which they satisfy.
--
-- §A12 idempotent. STATUS: UNAPPLIED — founder applies alongside the 0102/0103/0104 authz queue.

-- ── 1. Extend the immutability trigger to freeze the identity/tenant keys ──────
create or replace function check_resolution_immutability()
returns trigger language plpgsql as $$
begin
  if OLD.action_taken is distinct from NEW.action_taken then
    raise exception 'resolutions.action_taken is immutable';
  end if;
  if OLD.reasoning is distinct from NEW.reasoning then
    raise exception 'resolutions.reasoning is immutable';
  end if;
  if OLD.decided_at is distinct from NEW.decided_at then
    raise exception 'resolutions.decided_at is immutable';
  end if;
  -- Added by 0105: identity + tenant keys are set at creation, never changed on review.
  if OLD.decided_by is distinct from NEW.decided_by then
    raise exception 'resolutions.decided_by is immutable';
  end if;
  if OLD.company_id is distinct from NEW.company_id then
    raise exception 'resolutions.company_id is immutable';
  end if;
  if OLD.problem_id is distinct from NEW.problem_id then
    raise exception 'resolutions.problem_id is immutable';
  end if;
  return NEW;
end $$;
-- (trigger resolutions_immutable from 0005 already binds this function; no re-create needed.)

-- ── 2. Split `resolutions - all` so the decided_by check is INSERT-only ────────
-- Drop-if-exists BEFORE each create (not just the old `- all` name): the founder
-- applies this manually in the Supabase SQL editor (no migration tracking), so a
-- re-run or retry-after-partial-failure must not error on "policy already exists".
-- Without the three guards below, a second apply fails at `create "- select"` even
-- though the first apply succeeded — a false alarm mid-security-apply. This is what
-- makes the §A12-idempotent claim (line 49) actually true. (Fixed 2026-07-09.)
drop policy if exists "resolutions - all" on resolutions;
drop policy if exists "resolutions - select" on resolutions;
drop policy if exists "resolutions - insert" on resolutions;
drop policy if exists "resolutions - update" on resolutions;

create policy "resolutions - select" on resolutions
  for select using (company_id = auth_company_id());

create policy "resolutions - insert" on resolutions
  for insert with check (
    company_id = auth_company_id()
    and (decided_by = auth.uid() or decided_by is null)
  );

create policy "resolutions - update" on resolutions
  for update
  using (company_id = auth_company_id())
  with check (
    company_id = auth_company_id()
    -- `reviewer` is the SECOND authorship column (who reviewed the outcome). The only
    -- user-scoped path that sets it (resolutions/route.ts:80) sets reviewer = auth.uid();
    -- the durability sweep is service-role (bypasses RLS). So constraining reviewer to
    -- self-or-null closes the reviewer-spoof and completes the author-spoof class on this
    -- table, breaking no legitimate path. (decided_by/company_id/problem_id are frozen by
    -- the trigger above; reviewer is legitimately mutable across re-reviews, so it's guarded
    -- here in the policy, not frozen.)
    and (reviewer = auth.uid() or reviewer is null)
  );
