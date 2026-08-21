# BUILD — Meeting call-audio durability (client-only)

### Meeting call-audio recording
- write-path: `useMeetingCoaching` records the call with a `MediaRecorder` (15s timeslice). Each slice is pushed
  to `chunksRef` AND uploaded fire-and-forget (one retry) to the shared `/api/coach/sales-session/[id]/audio-chunk`
  route (owner-gated on the coaching_sessions row). On a clean Stop, `onstop` builds the full blob and calls the
  imported `persistRecording` (persistOnly → stamps `audio_asset_url`). Recorder created on FRESH start only,
  kept across reconnects (one webm, no seam).
- read-path: the stored `recording.webm` (from the clean-Stop persist, or stitched from the chunks by the
  existing `auto-close-stale-cron` for a never-Stopped meeting) is available for recovery + Phase-6 Dissect;
  `recording-purge-cron` already cleans the chunk prefix by age.

## Reused vs new
- REUSED (no new server code): the `/audio-chunk` route, `persistRecording`, `stitchSessionAudio` (+ its
  recreated-recorder seam guard), the auto-close-stale + recording-purge crons.
- NEW: the client recorder + chunk-upload in `useMeetingCoaching` (+ a duplicated tiny `postMeetingAudioChunk`,
  no edit to the sales hook).
