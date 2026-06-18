-- 0051 — Learning Mode preference on profiles.
--
-- Founder direction: a toggleable in-app help overlay. When ON, a
-- lightbulb FAB appears on every dashboard surface and clicking it
-- pulses every annotated element (button / field / feature). Hover
-- (or tap on mobile) shows a popover with a title + explanation.
--
-- Brand integration: ELOSTATE's logo is a lightbulb. A glowing bulb
-- ON A DARK SURFACE is the brand made literal — idea + guidance +
-- illumination. So Learning Mode renders only in dark mode by
-- design, and enabling it auto-switches the theme to dark.
--
-- Preference persists per-user across sessions and devices, so a
-- founder demoing the product to a prospect can keep Learning Mode
-- on without re-toggling. The OPT-IN ITSELF is the preference;
-- whether the lightbulb is currently "active" (showing pulses) is
-- transient session state held client-side.
--
-- Per CLAUDE.md §3.3 guide-don't-overtake — Learning Mode never
-- SENDS or DECIDES for the user. It explains. It teaches. The user
-- stays in the driver's seat.

alter table profiles
  add column if not exists learning_mode_enabled boolean not null default false;

-- Index isn't useful — this column is only ever read for the
-- currently-authenticated user (RLS-scoped to id = auth.uid()), not
-- queried across users.

-- ─────────────────────────────────────────────────────────────
-- End migration 0051.
-- The application layer (next commit) will:
--   • add /api/me/learning-mode GET + PATCH routes
--   • add LearningModeProvider context
--   • add LearningHint primitive component
--   • add the lightbulb FAB (dark-mode-only render)
--   • add the Settings toggle that auto-switches theme to dark
--     when enabled, plus explanation copy about the constraint
-- ─────────────────────────────────────────────────────────────
