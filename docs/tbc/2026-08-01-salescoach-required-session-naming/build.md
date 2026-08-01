# BUILD — required session naming (Phase 4)

## Doc integrity (§0.1) — command + output think.md section 1 refers to
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Changes (`src/app/dashboard/sales-coach/[id]/page.tsx`)
- Added naming-gate state: `namingOpen`, `sessionName`, `namingError`, `namingBusy`.
- Replaced `endSession` + `endThenAfterPitch` with `openNaming()` (pre-fills any existing name, opens the
  required modal) + `submitNameAndFinish()` (one PATCH `{status:"ended", clientLabel}` → After-Pitch).
- Routed ALL finish paths through it: the manual "End session" button, `onRecordingSaved`, `onLabeled`.
- Removed the now-dead `ending`/`setEnding` state.
- Added the required naming modal (no X, no backdrop-close, autofocus input, Save disabled until non-empty,
  Enter submits).
