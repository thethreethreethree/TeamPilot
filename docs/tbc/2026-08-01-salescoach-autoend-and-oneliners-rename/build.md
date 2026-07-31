# BUILD — Sales Coach auto-end (B) + One Liners rename (C)

## Doc integrity (§0.1) — the command + output think.md section 1 refers to

```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Both match docs/tbc/DOC_MANIFEST.json.

## B — auto-end on recording complete

`src/app/dashboard/sales-coach/[id]/page.tsx`:
- Added `endThenAfterPitch()` — PATCHes `status:"ended"` (try/catch, non-blocking) then
  `router.push(.../after-pitch)`.
- Wired BOTH recording-complete callbacks to it: `LiveCoachingPanel onRecordingSaved` (live path) and
  `SessionRecordingUpload onLabeled` (upload path). Previously each just `router.push`-ed without ending.

Write-path: recording completes → PATCH `status:ended` → 0070 trigger stamps `ended_at := now()` on the
active→ended transition (only when `ended_at is null`) → the session's duration + the avgSessionDuration KPI
now have a real end time. Re-end (already-ended session) → trigger no-op → original end time preserved.

## C — rename Strategy → One Liners

- `src/components/sales-coach/SalesCoachShell.tsx` — nav item label `"Strategy"` → `"One Liners"`. `href`
  kept `/dashboard/sales-coach/strategy` (no route rename → no broken links); icon unchanged.
- `src/app/dashboard/sales-coach/strategy/page.tsx` — TopBar `title` is now a constant `"One Liners"` (was
  `isStandard ? "One Liners" : "Strategy Library"`). Removed the now-unused `useExperienceMode` import +
  `isStandard` local. The two `LearningHint category="Sales Coach · Strategy"` → `"Sales Coach · One Liners"`.

Files:
- `src/app/dashboard/sales-coach/[id]/page.tsx`
- `src/components/sales-coach/SalesCoachShell.tsx`
- `src/app/dashboard/sales-coach/strategy/page.tsx`
