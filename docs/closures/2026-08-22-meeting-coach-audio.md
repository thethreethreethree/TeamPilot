# Closure — Meeting call-audio durability (2026-08-22)

Client-only: `useMeetingCoaching` now records the call and reuses the sales durability infra (the `/audio-chunk`
route, `persistRecording`, the stitch + purge crons) — no new server code. Full `npm run check` exit 0 (3572
tests); no sales/server change.

## Session-read manifest (§A22)

The machine-checked manifest — the §3.1.2 minimum set (no other citations in this diff), each with an in-session
`read_at` — lives in `docs/tbc/2026-08-22-meeting-coach-audio/think.md`. CLAUDE.md §§ are in the session's loaded
context; the ThinkerThinker axioms (A19, A22, A30, A38) were re-opened this session at 2026-08-22T00:01:03+08:00.
