# BUILD - Keep transcripts only

Migration 0314 (applied). No env keys or dashboard settings.

### Turn on "keep transcripts only"
write-path: Settings → Protection → Recording retention → "Keep transcripts only" → confirm (lists what is lost) → PUT
/api/coach/remote/settings/retention { transcriptOnly: true } (company admins) → company_recording_settings row with
transcript_only = true, no count → audit_log retention.set { transcriptOnly, graceHours }.
read-path: GET the same route → transcriptOnly: true → "Now: transcripts only — each call's audio is removed 24 hours
after its transcript is ready"; "Use the standard 90 days" or a count ends it (a new row).

### The nightly clean-up
write-path: recording-purge-cron → loadRetention (now reads transcript_only) → for transcripts-only companies: live =
status 'active'; for finished calls past 24 h, a head count on coaching_transcript_segments_current → hasTranscript →
outsideRetention → removeRecordingAudio + pointer nulled.
read-path: the call's transcript, scores and coaching stay; the cron's response reports transcriptChecks and
transcriptCheckErrors.
