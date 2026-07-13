-- 0168 acceptance — APPROVAL DELEGATION. Staging, 0116–0168 applied.
--
-- Every other acceptance file in this suite tests arithmetic. This one tests ATTACKS, because delegation
-- is the only feature in the financial system whose failure mode is not a wrong number — it is a wrong
-- PERSON holding authority, with an audit trail that endorses them.
--
-- A delegation row grants approval authority to someone who does not have it. So the assertions below are
-- written as an attacker would attempt them, and each MUST fail:
--
--   1. "The CFO delegates to me."          → forging a delegation FROM someone else.
--   2. "I delegate to myself."             → laundering a limit through a self-loop.
--   3. "Two viewers delegate to each other."→ manufacturing an approver out of nothing.
--   4. "I borrow more than the lender has."→ escalating past the delegator's own ceiling.
--   5. "I approve my own bill as a delegate."→ using borrowed authority to defeat segregation of duties.
--   6. "I extend my own delegation."       → silently restoring authority that was meant to lapse.
--
-- If any of these SUCCEEDS, the ledger's every approval becomes unfalsifiable — and unlike a wrong figure,
-- there is no later reconciliation that would reveal it.

begin;

-- ── Structure: the three defences exist ──
do $$ begin
  -- (2) self-delegation is meaningless and could only be an attempt to launder a limit
  if exists (select 1 from pg_constraint where conname = 'fin_deleg_not_self_ck')
  then raise notice 'DELEG PASS: self-delegation is forbidden by CHECK';
  else raise notice 'DELEG FAIL: a user could delegate to themselves and launder their own limit';
  end if;

  -- (1) the whole feature: you may only delegate authority you actually hold, FROM yourself
  if exists (
    select 1 from pg_policies
     where tablename = 'fin_approval_delegations'
       and cmd = 'INSERT'
       and with_check like '%delegator_id%auth.uid()%'
  ) then
    raise notice 'DELEG PASS: INSERT requires delegator_id = auth.uid() — you cannot mint a delegation FROM someone else TO yourself';
  else
    raise notice 'DELEG FAIL: a member could insert "the CFO delegates to me" and become a CFO, with an audit trail endorsing it';
  end if;

  -- (6) no UPDATE path — extending a window would silently restore lapsed authority
  if not exists (
    select 1 from pg_policies where tablename = 'fin_approval_delegations' and cmd = 'UPDATE'
  ) then
    raise notice 'DELEG PASS: no UPDATE policy — a delegation cannot be silently EXTENDED; revoke-and-reissue leaves both events on the record';
  else
    raise notice 'DELEG FAIL: an UPDATE path exists — a lapsed delegation could be quietly extended with no trace';
  end if;
end $$;

rollback;

-- ══ APP-LAYER — RUN THESE AS THE ATTACKER, NOT AS AN ADMIN ═══════════════════════════════════
--
-- CAST: CFO (limit NULL = unlimited) · APPROVER (limit 1,000) · MEMBER (no finance role) · VIEWER.
--
-- 1 · FORGERY.  As MEMBER, attempt:
--       insert into fin_approval_delegations (company_id, delegator_id, delegate_id, starts_on, ends_on)
--         values (auth_company_id(), '<CFO uuid>', auth.uid(), current_date, current_date + 30);
--     → MUST be denied by RLS (delegator_id <> auth.uid()).
--     THIS IS THE ASSERTION THE FILE EXISTS FOR. If it succeeds, the member is now a CFO — and every bill
--     they approve carries a perfectly valid audit trail naming the CFO as the source of authority. No
--     reconciliation, no balance check, no report would ever reveal it.
--
-- 2 · MANUFACTURE.  As MEMBER (no approval authority), call:
--       fin_delegate_approval('<other member uuid>', current_date, current_date + 7)
--     → MUST RAISE ("you cannot delegate approval authority you do not have").
--     Without this, two people with no authority could delegate to each other and produce an approver from
--     nothing.
--
-- 3 · BORROWED CEILING IS CAPPED.  APPROVER (limit 1,000) delegates to MEMBER.
--       fin_approval_limit_for(company, MEMBER) MUST return 1,000 — never NULL, never higher.
--     Then MEMBER attempts to approve a 1,200 bill → MUST RAISE (limit exceeded).
--     You cannot borrow more authority than the lender possesses.
--
-- 4 · UNLIMITED IS INHERITED.  CFO (limit NULL) delegates to MEMBER.
--       fin_approval_limit_for(company, MEMBER) MUST return NULL (unlimited for the window).
--     MEMBER approves a 50,000 bill → succeeds. This is the feature working: the honest path replaced
--     "just use my login".
--
-- 5 · SEGREGATION OF DUTIES SURVIVES DELEGATION — the second most important assertion here.
--     CFO delegates to MEMBER. MEMBER *creates* a bill, then attempts to approve it.
--     → MUST RAISE ("you cannot approve a bill you created").
--     SoD is a property of the person ACTING, not of the authority they borrowed. If delegation defeats
--     SoD, one person can now raise AND approve a payment to themselves — which is the exact fraud the
--     entire control structure exists to prevent, and delegation would have become its back door.
--
-- 6 · AUTHORITY EVAPORATES WITH THE LENDER.  CFO delegates to MEMBER, then the CFO's fin_roles row is
--     downgraded to 'viewer' (or deleted) while the delegation window is still open.
--     → fin_can_approve() for MEMBER MUST become false IMMEDIATELY.
--     The delegator's role is re-checked AT USE TIME, not at grant time: a delegation is a POINTER to
--     someone's authority, never a snapshot of it. If it were a snapshot, revoking a compromised
--     controller's role would leave their borrowed authority alive in the wild.
--
-- 7 · WINDOW.  A delegation dated in the future, or already ended, confers NOTHING. Assert both edges:
--     current_date = starts_on works; current_date = ends_on works (inclusive); one day either side does
--     not.
--
-- 8 · REVOCATION.  The delegator may revoke; a controller/CFO may revoke (someone must be able to end it
--     when the delegator is unreachable — which is the very situation delegation exists for); the DELEGATE
--     may NOT revoke someone else's delegation, and a MEMBER may not revoke at all.
--     After revocation, fin_can_approve() for the delegate MUST become false immediately.
