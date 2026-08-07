# CHECK — Re-transcribe recovery

## Verification (A38 — the canonical command, by name, with coverage + exit)
Ran `npm run check` (its own definition: typecheck && lint && theme:audit && rls:audit &&
invariant:audit && tbc && test).

```
invariant:audit — Files scanned: 750 · Documented exceptions: 36 · Violations: 0
tbc — tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
test — Test Files 351 passed | 1 skipped (352) · Tests 2340 passed | 15 skipped (2355)
=== check exit code: 0 ===
```

Coverage: all six gate steps executed (typecheck, lint, theme:audit, rls:audit, invariant:audit, tbc,
test) — exit 0. The new tests within that run:
- `src/app/api/coach/sales-session/[id]/retranscribe/__tests__/route.test.ts` — 9 cases (401/404/403/409/
  422/502/200-owner/200-manager/502-audioSaved).
- `src/lib/storage/__tests__/assetUrlToStoragePath.test.ts` — 6 cases (parse contract).

## Reachability (A31 — assert BOTH seam directions, not the file list)
```json
[
  {
    "feature": "Re-transcribe an orphaned recording from storage",
    "files": [
      "src/app/api/coach/sales-session/[id]/retranscribe/route.ts",
      "src/lib/storage/assets.ts (downloadAssetBytes, assetUrlToStoragePath)",
      "src/components/sales-coach/SessionRecordingUpload.tsx",
      "src/app/dashboard/sales-coach/[id]/page.tsx"
    ],
    "write_path": {
      "exists": true,
      "where": "SessionRecordingUpload.tsx retranscribe() → POST /retranscribe; button rendered at page.tsx via hasSavedRecording={!!session?.audioAssetUrl && transcript.length===0}",
      "human_can_set": true
    },
    "read_path": {
      "exists": true,
      "where": "route returns {segments,speakers} → speaker-tap → POST /label-transcript appends → existing transcript section on page.tsx renders it; review unlocks on transcript.length>0",
      "human_can_see": true
    }
  }
]
```
Both directions exist and are human-operable: a manager/owner can TRIGGER it (button, gated to the orphaned
state) and SEE the result (the transcript renders through the unchanged read path). Not dead config.

## Sweep (§1.5.2 — adjacent same-class check)
- The one other consumer of `audio_asset_url` that parses the pointer (`recording-purge-cron`) inlines the
  same strip logic. It is NOT refactored to `assetUrlToStoragePath` in this build (out of scope, and it
  already handles the case correctly) — flagged as a DRY follow-up in closure residual, not silently left.
- The second render site of `SessionRecordingUpload` (`LiveCoachingPanel`, live/active session) does not pass
  `hasSavedRecording`; it defaults false — correct, the recovery affordance is meaningless mid-live-call.

## Findings
no findings — the route adds no transcript write path (reuses the single latch-guarded `/label-transcript`
appender); the owner-or-manager gate and the empty-transcript button gate close the tenant-leak and
duplicate-append classes; the full gate ran exit 0. The one deliberate deferral (folding
`recording-purge-cron` onto `assetUrlToStoragePath`) is recorded as closure residual RES-01, not a silent skip.
