# Session-Reads closure — Settings Slice 1: Theme (2026-07-29)

Full session-read manifest (12 entries, this-session read_at) in
`docs/tbc/2026-07-29-x2-settings-theme/think.md`, validated by verify-manifest.mjs.
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md
A19, A22, A28, A31, A34, A30, A38.

First slice of "make Settings substantial": theme becomes company default + per-user override + DB
persistence (was localStorage-only). Migration `0201` adds `profiles.theme_preference` (self-editable)
+ `companies.default_theme` (admin-set). `/api/me/theme` mirrors `/api/me/learning-mode` (A28); every DB
touch is guarded with `isMissingColumnError` so a pending 0201 degrades to localStorage-only (A34). The
resolution rule is the pure, unit-pinned `reconcileTheme` (6 assertions). `npm run check` exits 0 (1608
tests). Migration written but NOT applied — guarded, non-breaking until `npm run db:apply`.
