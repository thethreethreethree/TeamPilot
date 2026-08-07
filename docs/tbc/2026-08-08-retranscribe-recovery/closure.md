# CLOSURE — Re-transcribe recovery for orphaned recordings

## What shipped
A manager/owner-gated recovery path that re-transcribes a session's ALREADY-STORED audio, for the orphaned
state the STT outage produced (recording saved, transcript never landed). New route
`POST /api/coach/sales-session/[id]/retranscribe` downloads the stored bytes, re-diarizes, and returns
`{segments,speakers}` — the identical shape `/upload-recording` returns — then hands off to the EXISTING
speaker-tap → `/label-transcript` append. A "Re-transcribe from saved recording" button appears on the
session page only when a recording exists and the transcript is empty. Two reusable primitives were added to
`storage/assets.ts`: `downloadAssetBytes` and `assetUrlToStoragePath`.

## Un-named reliance (not self-evident)
- **The route deliberately does NOT append the transcript.** It is read-plus-transcribe only. The transcript
  keeps its single sanctioned appender (`/label-transcript`, latch-guarded). Do not "streamline" this by
  appending inside the route — that reintroduces the append-only double-write class this design avoids.
- **The button is gated on `transcript.length === 0` for a reason.** Re-transcribing a session that already
  has a transcript and then tapping a speaker would APPEND a full duplicate transcript (append-only, no
  delete). The empty-transcript gate is the guard; removing it would poison the record downstream scoring
  runs on.
- **An unrecognized `audio_asset_url` returns 422, not a best-effort download.** A non-`${ASSETS_BUCKET}/…`
  pointer (the shape `recording-purge-cron` flags "malformed") means we cannot know the object's real path,
  so we refuse rather than feed a raw string to storage. `assetUrlToStoragePath` returns null and the route
  422s. This mirrors the cron's "leave it alone" caution.
- **Owner-OR-manager, because `getSession` is company-scoped (INV19).** The route returns call content, so a
  colleague in the same company must not pull another rep's call. The gate is `session.agentId === user.id ||
  isSalesCoachManager`.
- **Recovery still depends on the ElevenLabs STT scope being enabled.** This route re-runs the same
  diarization that 502'd during the outage; on a 502 it returns `audioSaved:true` so retry is honest. Once
  the founder enables the Speech-to-Text scope, the 4 orphaned recordings recover through this path.

## Flagged, not fixed (§3.3)
- `recording-purge-cron` still inlines the pointer-strip logic instead of calling the new
  `assetUrlToStoragePath`. Correct today; a DRY follow-up, not a defect. → residual RES-01.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "recording-purge-cron inlines the audio_asset_url strip instead of calling assetUrlToStoragePath.", "why_skipped": "The cron already handles the parse correctly and refactoring it is out of this build's authorized scope; touching the retention-deletion path carries more risk than the DRY win. Centralizing it later removes the last divergent copy.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-08T04:00:00Z", "outcome": "OPENED — fold the cron onto assetUrlToStoragePath in a follow-up; behavior is already equivalent." },
  { "id": "RES-02", "item": "No live end-to-end capture of the button recovering a real orphaned session.", "why_skipped": "The session page is owner-private (RLS) and needs real recorded call data; it can't be headlessly captured. Proven at the route/unit layer (9 route cases + 6 parse cases) and the full gate exit 0. Final confirmation is the founder re-transcribing one of the 4 orphaned recordings once the STT scope is enabled.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T04:00:00Z", "outcome": "OPENED — verify on a real orphaned session after the ElevenLabs Speech-to-Text scope is enabled." }
]
```
