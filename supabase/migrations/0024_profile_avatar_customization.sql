-- 0024 — Profile avatar customization
--
-- Users can pick the color + initials shown in their avatar across
-- chat, tasks, and notifications. Pure cosmetic — no behavior change,
-- no §3.1 chain implication. Each user owns and edits their own row;
-- RLS policy already covers "I can update my own profile" via the
-- existing profiles policies.
--
-- avatar_color  — text, intended to hold a hex like '#FACC15'. We
--                 store free-text (validated client-side against the
--                 palette) so future palette expansions don't require
--                 a constraint migration.
-- avatar_initials — text up to 3 chars. NULL → fall back to deriving
--                 initials from full_name (existing behavior). Allows
--                 nicknames like "JR" or single-letter "J".
--
-- A12 (migration safe-to-re-run): every object uses ADD COLUMN IF
-- NOT EXISTS so re-runs are clean.

alter table profiles
  add column if not exists avatar_color text;

alter table profiles
  add column if not exists avatar_initials text
    check (avatar_initials is null or length(avatar_initials) between 1 and 3);

comment on column profiles.avatar_color is
  'User-chosen avatar background color. Hex string (e.g. ''#FACC15''). NULL → palette default.';
comment on column profiles.avatar_initials is
  'User-chosen avatar initials, 1–3 chars. NULL → derive from full_name.';
