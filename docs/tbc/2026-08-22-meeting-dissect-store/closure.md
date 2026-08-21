# CLOSURE — Meeting Dissect generate-and-store

## What shipped
`generateAndStoreMeetingDissect` — persists the dissect as an append-only event on signal
(`meeting.dissect_generated`), or a `meeting.dissect_attempted` backoff marker on a with-turns no-signal run
(the sales dissect-cost-loop lesson, encoded). Mirrors sales `runAndStoreDissect`; reuses `createAdminClient` +
`events`. New strategy-dir function + 3 tests; full `npm run check` exit 0 (3581 tests); no sales/server change.

## The un-named reliance
- **A caller that supplies the diarized transcript.** This stores what it's given; producing the diarized
  transcript (re-transcribe the durable audio) is the next increment's job — nothing calls this in production yet.
- **DB insert confirmed on the real trigger.** Tested against a captured-calls mock; the real `events` insert is
  confirmed when the trigger runs end-to-end.

## Open (next increments)
1. Re-transcribe the durable meeting audio with diarization (reuse sales retranscribe + autoSpeakerAssign).
2. A trigger (on-view or cron) that calls `generateAndStoreMeetingDissect`.
3. A post-meeting review UI + the per-team improvement-trend aggregate (no control baseline — audit finding).

## Residual (A36 — ranked by confidence it doesn't matter; the top is examined)

```json
[
  {
    "id": "event-subject-namespace",
    "item": "Meeting dissects use event subject `meeting_session:<id>` while sales uses `sales_session:<id>`, though both are coaching_sessions rows.",
    "why_skipped": "Distinct namespaces keep meeting and sales dissect events cleanly separable on the shared events table + let each aggregate query its own kind; a shared namespace would force every consumer to also filter by session_kind.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-22T01:02:00+08:00",
    "outcome": "Examined the sales aggregate/backfill queries: they key on subject prefix + kind, so a distinct meeting subject means the sales consumers never accidentally pick up a meeting dissect and vice versa — the safer default. Confirmed correct; the future meeting aggregate will query `meeting_session:` + `meeting.dissect_generated`."
  }
]
```
