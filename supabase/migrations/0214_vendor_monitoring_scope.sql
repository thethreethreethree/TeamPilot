-- 0214_vendor_monitoring_scope.sql
--
-- FOUNDER-DIRECTED EXEMPTION (2026-08-16, John + Moses, equal owners).
--
-- WHAT: a SANCTIONED, contained cross-tenant capability that lets the two vendor
-- founders (Elostate super-admins) MONITOR sessions across the companies that
-- ALREADY EXIST in the system, at a customer owner's personal request. This is a
-- deliberate exemption to the tenant-isolation invariants (the same ones the
-- 2026-08-15 peer-rep IDOR fix hardened) — recorded here, not smuggled in.
--
-- WHY THIS SHAPE (the discipline behind the exemption):
--   1. It does NOT weaken any customer-facing RLS. The coaching_sessions /
--      _transcript_segments / _cues / after_pitch_summaries SELECT policies stay
--      exactly as tight as 0083/0084 left them. All cross-tenant access is
--      contained to ONE vendor-side, service-role surface (/api/admin/monitoring/*)
--      gated by requireVendorAdmin — so a regression in one predicate can't silently
--      open every customer's data to every caller.
--   2. It is ALLOWLISTED to EXISTING companies only. `vendor_monitoring_scope` is
--      seeded from the companies that exist AT APPLY TIME. There is NO trigger that
--      adds new companies — a customer onboarded tomorrow is NOT monitorable until a
--      founder deliberately adds it. This encodes the founder's explicit constraint:
--      "we will not and should not have immediate access for new customers."
--   3. Every access is AUDITED. `vendor_monitoring_access_log` records who read what,
--      when — so the capability is accountable, not a silent backdoor.
--   4. WHO = is_vendor_super_admin() (admin of the vendor company, hardened in 0089)
--      — which is exactly the two founders. No new role, no per-company membership,
--      no pollution of any customer's member list.
--
-- Forward-only. Creates two vendor-only tables + seeds the allowlist. Grants NOTHING
-- to customer users (both tables are is_vendor_super_admin()-gated). If the vendor id
-- is mis-set, the tables are simply unreadable (fails CLOSED), never broad-open.

-- ── The allowlist: which companies a founder may monitor ─────────────────────────
create table if not exists vendor_monitoring_scope (
  company_id   uuid primary key references companies(id) on delete cascade,
  added_at     timestamptz not null default now(),
  added_reason text
);

comment on table vendor_monitoring_scope is
  'Founder cross-tenant monitoring allowlist (0214 exemption). Companies a vendor '
  'super-admin may monitor. Seeded from EXISTING companies at apply time; new '
  'companies are NOT auto-added (no trigger) — a founder adds one deliberately.';

alter table vendor_monitoring_scope enable row level security;

-- Vendor super-admins (the founders) manage + read the allowlist. No customer access.
drop policy if exists "vendor_monitoring_scope - all" on vendor_monitoring_scope;
create policy "vendor_monitoring_scope - all" on vendor_monitoring_scope
  for all using (is_vendor_super_admin()) with check (is_vendor_super_admin());

-- Snapshot the CURRENTLY-existing companies. New companies created after this
-- migration are intentionally excluded (the founder's "existing only" constraint).
insert into vendor_monitoring_scope (company_id, added_reason)
  select id, 'initial snapshot 2026-08-16 — existing companies at founder monitoring grant'
  from companies
on conflict (company_id) do nothing;

-- ── The audit trail: every monitoring read is logged ────────────────────────────
create table if not exists vendor_monitoring_access_log (
  id          bigint generated always as identity primary key,
  actor       uuid not null,
  company_id  uuid,
  session_id  uuid,
  resource    text not null,
  accessed_at timestamptz not null default now()
);

comment on table vendor_monitoring_access_log is
  'Append-only audit of founder cross-tenant monitoring reads (0214 exemption). '
  'Written by the service-role monitoring API; readable by vendor super-admins.';

create index if not exists vendor_monitoring_access_log_actor_idx
  on vendor_monitoring_access_log (actor, accessed_at desc);
create index if not exists vendor_monitoring_access_log_company_idx
  on vendor_monitoring_access_log (company_id, accessed_at desc);

alter table vendor_monitoring_access_log enable row level security;

-- Vendor super-admins may READ the audit trail (accountability). Writes come from
-- the service-role API only (service role bypasses RLS), so no user INSERT policy —
-- a customer can neither read nor forge the log.
drop policy if exists "vendor_monitoring_access_log - select" on vendor_monitoring_access_log;
create policy "vendor_monitoring_access_log - select" on vendor_monitoring_access_log
  for select using (is_vendor_super_admin());
