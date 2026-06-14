-- 0031 — §3.4 month-cycle automation (control → intervention)
--
-- §3.4 of the constitution mandates a structurally honest cycle:
--   Month 1 = control — Coach OFF. Captures an honest baseline of the
--     team operating as themselves. This is BOTH a clean A/B condition
--     AND a chance to harvest unperformed behavior.
--   Month 2 = single-variable intervention — Coach ON. The only thing
--     that changed is the guidance layer, so improvement is
--     attributable to the method, not to luck or circumstance.
--
-- Without enforcement, this discipline lives entirely in the founder's
-- self-control. §5 names this exact failure mode — "the biggest risk
-- is the builder under pressure" — and §7.1 default-deny makes the
-- structural defense the right place: the database refuses to flip
-- coach_enabled to true during the control window, period. Override
-- is possible but it leaves a permanent on-the-record mark so the §4
-- readout can flag companies that skipped control.
--
-- A12 idempotent: every add column / constraint / trigger / function
-- uses if-not-exists or create-or-replace so re-runs are clean. No
-- data backfill needed beyond the cycle_started_at default to
-- created_at for existing rows.

-- ─── Columns ───────────────────────────────────────────────────
-- cycle_started_at — the anchor for the company's control window.
-- Defaults to created_at on backfill (an existing company's cycle
-- started when they registered). Future companies will use their
-- own created_at as the default.
alter table companies
  add column if not exists cycle_started_at timestamptz;

-- Backfill: any row missing the anchor adopts its created_at. Safe
-- to re-run; only NULL rows are touched.
update companies
  set cycle_started_at = created_at
  where cycle_started_at is null;

-- Once backfilled, lock the column to NOT NULL with a default so
-- new companies always have an anchor at INSERT time. Drop+re-add
-- the default to keep the migration idempotent on re-run.
alter table companies
  alter column cycle_started_at set not null;
alter table companies
  alter column cycle_started_at set default now();

-- cycle_control_skipped_at — when an admin deliberately overrode the
-- control window. NULL by default; only set by the explicit
-- "skip control" admin action. Once set, never cleared (§3.1
-- immutability + the readout needs the permanent on-record mark).
alter table companies
  add column if not exists cycle_control_skipped_at timestamptz;

alter table companies
  add column if not exists cycle_control_skipped_by uuid
    references auth.users(id) on delete set null;

alter table companies
  add column if not exists cycle_control_skip_reason text;

-- ─── Phase resolver function ───────────────────────────────────
-- A SQL function the trigger + the readout can both call. Returns
-- 'control' for days 0-29 from cycle_started_at, 'intervention' for
-- days 30-59, and 'ongoing' for day 60+. Companies with a skip
-- timestamp set bypass control entirely (they jump straight to
-- intervention from the skip point).
create or replace function company_cycle_phase(
  cycle_start timestamptz,
  skipped_at timestamptz
) returns text
language sql
immutable
as $$
  select case
    when skipped_at is not null then 'intervention'
    when extract(epoch from (now() - cycle_start)) < 30 * 24 * 3600 then 'control'
    when extract(epoch from (now() - cycle_start)) < 60 * 24 * 3600 then 'intervention'
    else 'ongoing'
  end;
$$;

comment on function company_cycle_phase(timestamptz, timestamptz) is
  'Resolve a company''s §3.4 cycle phase from its anchor. Used by the
   coach_enabled trigger to enforce the control window, and by the §4
   readout to attribute outcomes to the right phase.';

-- ─── Enforcement trigger ───────────────────────────────────────
-- Block any UPDATE that sets coach_enabled = true while the company
-- is in the control phase (and hasn't explicitly skipped). The
-- error message names §3.4 directly so the failure is legible to
-- the admin from the API response.
create or replace function enforce_coach_control_window()
returns trigger
language plpgsql
as $$
declare
  phase text;
begin
  -- Only check on actual flips: false→true. Other transitions are
  -- always permitted (turn off, no-op, etc.).
  if (new.coach_enabled is true) and (old.coach_enabled is distinct from true) then
    phase := company_cycle_phase(new.cycle_started_at, new.cycle_control_skipped_at);
    if phase = 'control' then
      raise exception
        '§3.4 control window — the Coach cannot be enabled during the first 30 days. This is the structural defense: Month 1 captures an honest baseline of the team operating as themselves, so Month 2''s single-variable intervention is attributable. To override, an admin can record an explicit cycle_control_skip — the readout will flag that company as "skipped control."'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_coach_control_window on companies;
create trigger trg_enforce_coach_control_window
  before update on companies
  for each row
  execute function enforce_coach_control_window();

comment on trigger trg_enforce_coach_control_window on companies is
  '§3.4 control window enforcement. Refuses to flip coach_enabled to
   true during the first 30 days unless cycle_control_skipped_at is
   set. The override path is intentionally on-the-record so the §4
   readout can attribute outcomes correctly.';

-- ─── Column documentation ─────────────────────────────────────
comment on column companies.cycle_started_at is
  '§3.4 anchor. The Coach is locked OFF for the first 30 days from
   this timestamp (control phase) so the §4 readout has an honest
   baseline. Defaults to created_at on backfill.';

comment on column companies.cycle_control_skipped_at is
  'Set when an admin explicitly overrides the §3.4 control window
   via the "skip control" action. Once set, never cleared (§3.1
   immutability). Triggers the §4 readout to flag the company as
   "skipped control" so outcomes are attributed honestly.';

comment on column companies.cycle_control_skipped_by is
  'The auth.users id of the admin who recorded the skip. Audit trail
   for §5 — the discipline this codifies generalizes, and the
   on-record actor is the structural defense against the failure
   mode of "the builder under pressure."';

comment on column companies.cycle_control_skip_reason is
  'Free-form admin-supplied reason for skipping control. Stored so
   the §4 readout can surface WHY companies skipped — useful for
   distinguishing legitimate cases (e.g., pre-existing measurement
   from a parallel system) from convenience-driven shortcuts.';
