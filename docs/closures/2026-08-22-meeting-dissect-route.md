# Closure — Meeting Dissect route (2026-08-22)

`POST /api/coach/meeting-session/[id]/dissect` — the post-meeting review trigger: owner-gated, returns a cached
dissect event or transcribes the durable audio with N-party diarization → generate-and-stores → returns. New
route + 7 tests; full `npm run check` exit 0 (3588 tests); no sales/server change. The Dissect is now reachable
end-to-end; the review UI + trend aggregate remain.

## Session-read manifest (§A22)

The §3.1.2 minimum set (no other citations in the diff), each with an in-session `read_at`, lives in
`docs/tbc/2026-08-22-meeting-dissect-route/think.md`. CLAUDE.md §§ are in the session's loaded context; the
ThinkerThinker axioms (A19, A22, A30, A38) were re-opened this session at 2026-08-22T00:26:47+08:00.
