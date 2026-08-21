# Closure — Meeting hook start() Stop-during-setup guard (2026-08-22)

The zero-risk half of the review's shared `start()`-race finding: `useMeetingCoaching.start()` now honors
`stoppedRef` after each setup await (no zombie "live" session on a Stop-during-startup). Client-only; full
`npm run check` exit 0 (3572 tests). The identical sales-hook race stays FILED for a coordinated founder-aware
pass.

## Session-read manifest (§A22)

The §3.1.2 minimum set (no other citations in the src diff), each with an in-session `read_at`, lives in
`docs/tbc/2026-08-22-meeting-coach-start-race/think.md`. CLAUDE.md §§ are in the session's loaded context; the
ThinkerThinker axioms (A19, A22, A30, A38) were re-opened this session at 2026-08-22T00:26:47+08:00.
