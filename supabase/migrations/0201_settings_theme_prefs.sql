-- 0201_settings_theme_prefs.sql
-- Substantial Settings (founder decision 2026-07-28): theme becomes
-- "company default + per-user override + DB persistence" (was localStorage-only).
--
-- Resolution at read time:  user theme_preference  ->  company default_theme  ->  'system'.
--
-- profiles.theme_preference is NULLABLE (null = "inherit the company default"). It is
-- deliberately NOT added to the 0090 privileged-column guard, so a user can set their own
-- theme via the normal self-RLS on profiles — exactly like learning_mode_enabled (0051) and
-- experience_mode (0110), the sibling per-user prefs this copies (A28).
--
-- companies.default_theme is admin-set (gated by the companies UPDATE RLS, same as timezone /
-- name on migration 0009). NOT NULL DEFAULT 'system' so every existing company row is valid
-- immediately with no backfill.
--
-- Both use `add column if not exists` so re-application is safe; the app code that reads these
-- columns degrades to localStorage-only if this migration has not been applied (A34).

alter table public.profiles
  add column if not exists theme_preference text
    check (theme_preference is null or theme_preference in ('system','light','dark'));

alter table public.companies
  add column if not exists default_theme text not null default 'system'
    check (default_theme in ('system','light','dark'));

comment on column public.profiles.theme_preference is
  'Per-user theme override: system|light|dark, or NULL to inherit companies.default_theme. Self-editable (not in the 0090 privileged-column guard).';
comment on column public.companies.default_theme is
  'Company default theme, applied when a user has no personal theme_preference. Admin-set via the Settings surface (gated by the companies UPDATE RLS).';
