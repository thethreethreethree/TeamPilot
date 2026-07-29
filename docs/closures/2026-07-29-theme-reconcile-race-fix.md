# Session-Reads closure — theme reconcile race fix (2026-07-29)

Full session-read manifest (11 entries, this-session read_at) in
`docs/tbc/2026-07-29-x4-theme-reconcile-race-fix/think.md`, validated by verify-manifest.mjs.
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md
A19, A22, A26, A30, A33, A38.

A post-build self-audit (§1.3 outside-view) of this session's shipped code found a real race in the theme
slice (03bc57d4): the DB-reconcile effect passed a stale mount-time `localRaw` to `reconcileTheme` after
its async fetch, so a theme the user picked WHILE the fetch was in flight was silently reverted to the
DB/company value. Fixed by re-reading localStorage after the fetch and skipping when the user has since
chosen. Gate declined per A33 (capture-before-await staleness isn't precisely detectable); the re-read +
the reconcileTheme local-wins unit test are the defense. Other session surfaces audited (theme route
scoping, format util, migration 0201, revision gate) — no findings. `npm run check` exits 0.
