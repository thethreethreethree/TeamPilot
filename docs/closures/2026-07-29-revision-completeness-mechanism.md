# Session-Reads closure — revision-completeness mechanism (2026-07-29)

Full session-read manifest (12 entries, this-session read_at) in
`docs/tbc/2026-07-29-x-revision-completeness-mechanism/think.md`, validated by verify-manifest.mjs.
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md
A19, A22, A26, A30, A33, A36, A38.

This build delivers the permanent structural fix for the recurring "revision reported done while
partial" class the founder named critical: a durable unfinished-work + risks ledger
(`docs/BUILD-STATE.md`, read first on resume) and a revision-completeness gate
(`scripts/tbc/verify-revision.mjs`, runnable via `npm run tbc:revision`) that fails a build's closure
if any declared requested change is un-dispositioned, done-without-evidence, or deferred-without-reason.
Mandatory-chain wiring is proposed via `AMD-009` (governance = founder ratification, A28).

`npm run check` exits 0 (output pasted in the build's closure.md verification record).
