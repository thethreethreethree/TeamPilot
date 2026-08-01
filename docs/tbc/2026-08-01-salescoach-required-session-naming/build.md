# BUILD — required session naming (Phase 4)

## Doc integrity (§0.1) — command + output think.md section 1 refers to
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

### Required naming gate on every finish path
`src/app/dashboard/sales-coach/[id]/page.tsx` — replaced `endSession` + `endThenAfterPitch` with `openNaming()`
+ `submitNameAndFinish()`, and routed ALL finish paths (manual "End session", `onRecordingSaved`, `onLabeled`)
through it.

- **write-path:** `submitNameAndFinish` sends ONE PATCH `{ status:"ended", clientLabel:name }` — ending +
  naming atomically. The 0070 trigger stamps `ended_at` on active→ended (idempotent re-finish). On error it
  keeps the modal open with a message (never traps the rep half-ended).
- **read-path:** on success it `router.push(.../after-pitch)`; After-Pitch reads the just-ended session and
  auto-generates Your Read + scoreboard. The session now carries `clientLabel`, so it reads as a named row in
  the Sessions list.

### Required naming modal
`src/app/dashboard/sales-coach/[id]/page.tsx` — a non-dismissible modal (no X, no backdrop-close) with state
`namingOpen`/`sessionName`/`namingError`/`namingBusy`.

- **write-path:** the input's `onChange` sets `sessionName`; Enter or the Save button calls
  `submitNameAndFinish` (Save disabled until `sessionName.trim()` is non-empty).
- **read-path:** rendered when `namingOpen`, autofocus input pre-filled with any existing `clientLabel`; shows
  `namingError` inline on failure and a pending "Saving…" state while the PATCH is in flight.

Files:
- `src/app/dashboard/sales-coach/[id]/page.tsx`
