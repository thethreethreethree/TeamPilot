# CLOSURE - carry the recording's own timing into spoken_at

The Coach Assessment "speed" skill has never scored an uploaded recording, and the reason was not a missing
measurement. The diarizer has always returned each segment's offset into the audio; one function on the way
back to the client typed it away, and the rest of the chain had nowhere to put it. It is carried now, joined to
the session's own start time, and written as `spoken_at` when the rep says which voice is theirs.

The native app's REV1 doc 04 asked the APP to stamp this. That instruction was written for the web's live
client and does not fit the app, which uploads audio and reads back a transcript it never composed. The
correction is on the record in check.md; the app's part is to carry the offset back, which it now does on
purpose rather than by accident.

## What this does NOT do (un-named-reliance half)
- Migration 0249 is NOT applied. The fix works without it - only the recovery re-transcribe path waits on it.
- No existing session is backfilled. Sessions recorded before this deploy still have `spoken_at = null` and
  their pace skill stays blank; the skill lights up for calls uploaded from here on.
- The base is the session's `started_at`, so the clock shown beside a transcript line is accurate to when the
  session was opened rather than to the instant the microphone started. Gaps, and therefore the score, are
  exact either way.
- Not observed on production. The chain is pinned by tests at both ends; no uploaded call has yet been recorded
  and its skill read back on the live system.

## Residual (A36 - read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-recovery-replace-unproven",
    "item": "The RECOVERY re-transcribe path (replaceSessionTranscript -> the 0249 RPC) is plumbed but not proven end to end - it is the branch I was most confident about because the JS change is two lines, and it is the branch that depends on an unapplied migration.",
    "why_skipped": "The route test covers the first-label path (appendTranscriptSegment); the replace path runs through a database function that cannot be exercised without a live DB.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-10T11:50:00+08:00",
    "outcome": "OPENED. Until 0249 is applied the pre-0249 function ignores the spokenAt key and selects null, which is exactly today's behaviour - so the risk is a lost timing on one path, never a lost transcript. After 0249 lands, the first recovery re-transcribe should be checked for a non-null spoken_at. Flagged, not fixed." },
  { "id": "R2-no-backfill",
    "item": "Every call already uploaded keeps a blank pace skill; nothing recomputes offsets for stored audio.",
    "why_skipped": "A backfill would mean re-transcribing stored audio at provider cost, which is a founder decision and not part of closing the drop.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },
  { "id": "R3-wpm-band-unvalidated",
    "item": "Whether the 110-150 wpm band and the 60-320 plausibility window are right for door-to-door speech, now that real timings will finally reach them.",
    "why_skipped": "The band predates any timed uploaded data; judging it needs the data this build starts producing.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## Verification
See check.md - the mutation proof with both named failures, the targeted suite, and the whole `npm run check`
output with its exit code.
