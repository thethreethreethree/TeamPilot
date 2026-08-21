# Closure — Meeting Coach client review-fix pass (2026-08-22)

Four correctness fixes from an independent adversarial review of the untestable meeting client (cross-session cue
isolation, bounded reconnect, cue-status feedback, per-session state hygiene), each mirroring a proven
`useLiveCoaching` guard. Client-only; full `npm run check` exit 0 (3572 tests); no sales/server change.

## Session-read manifest (§A22)

The machine-checked manifest — the cited §3.4 plus the §3.1.2 minimum set, each with an in-session `read_at` —
lives in `docs/tbc/2026-08-22-meeting-coach-review-fixes/think.md`. CLAUDE.md §§ are in the session's loaded
context; the ThinkerThinker axioms (A19, A22, A30, A38) were re-opened this session at 2026-08-22T00:26:47+08:00.
