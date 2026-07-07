-- 0098 — team_invitations: at most ONE pending invitation per (company, email)
--
-- Bug context (founder-reported 2026-07-07, invite flow audit). The
-- "duplicate-prevention #1" guard in POST /api/team detected an existing pending
-- invite with .maybeSingle(). There was no DB uniqueness on (company_id, email)
-- for pending invites, so 2+ could exist — and .maybeSingle() ERRORS on multiple
-- rows, making the guard silently skip and create yet another duplicate (the guard
-- defeated by the duplicates it exists to prevent). The route now uses .limit(1)
-- (works regardless of count); THIS migration is the structural fix — AMD-006
-- Layer 1 (build-structure): make duplicate pending invites impossible at the DB,
-- so no code path can reintroduce them.
--
-- NOTE (founder-applied, MODIFIES EXISTING ROWS): step 1 revokes older duplicate
-- pending invites so step 2's unique index can build. It does NOT delete anything
-- (§3.1 append-only) — it uses the existing revoke soft-state, keeping the NEWEST
-- pending invite per (company, email). Re-run-safe (§A12): step 1 is a no-op once
-- deduped; step 2 is `if not exists`.

-- 1. Revoke older duplicate pending invites (keep the newest per company + email).
with ranked as (
  select
    id,
    row_number() over (
      partition by company_id, lower(email)
      order by invited_at desc, id desc
    ) as rn
  from team_invitations
  where accepted_at is null
    and revoked_at is null
)
update team_invitations t
set
  revoked_at = now(),
  revoke_reason = 'Superseded — duplicate pending invitation (migration 0098)'
from ranked
where t.id = ranked.id
  and ranked.rn > 1;

-- 2. Structural guarantee: at most one LIVE (un-accepted, un-revoked) invitation
--    per (company_id, lower(email)). Case-insensitive to match the route's
--    normalizedEmail (lower+trim). PARTIAL so accepted/revoked history stays
--    unbounded (append-only, §3.1) — only the pending set is constrained.
create unique index if not exists team_invitations_one_pending_per_email
  on team_invitations (company_id, lower(email))
  where accepted_at is null and revoked_at is null;
