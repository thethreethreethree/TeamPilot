# BUILD - Fix past calls with the vocabulary's corrections

Migration 0368 (rss_transcript_version_with_texts, service role only). No env keys.

### A company admin checks, then fixes past calls
write-path: POST /api/coach/remote/settings/vocabulary/reapply {apply:true} → admin → corrections → the last 180 days' finished phone/video calls (newest 500) → current lines → planReapply → up to 50 calls: rpc rss_transcript_version_with_texts (from their current version; -1 = skipped) → audit vocabulary.reapply → after(): getSessionTranscript + generateSessionArtifacts per fixed call.
read-path: POST {apply:false} → the same scan → { calls, lines, scanned, capped, batch } → "N calls (M lines) would change … one AI pass per call" on the vocabulary screen.
