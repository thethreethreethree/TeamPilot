# CLOSURE - a transcript has versions

## What is true now (in the repo; nothing is applied or deployed yet)

A repair or relabel appends a version and keeps the old one; every reader, web and app, reads the newest.

## Residual

```json
[
  {
    "id": "R1-migration-not-applied",
    "item": "0269 is not applied to production; the website commit must not deploy before it.",
    "why_skipped": "A production migration needs the founder's go-ahead.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-03T07:30:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R2-app-embed-unproven",
    "item": "The app's embedded count through the view (PostgREST relationship inference on a view) is unproven until 0269 is live.",
    "why_skipped": "Needs the view in production; a read-only request will confirm it before app build 30.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-03T07:30:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R3-stuck-calls-not-repaired",
    "item": "The 12 stuck calls are not repaired yet; their recovery budget is spent.",
    "why_skipped": "Needs 0269 live, then a deliberate re-run.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-03T07:30:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Rollout (appended 2026-10-03T08:35Z; founder picker: "All of it, in order")

1. `node scripts/db-apply.mjs --verify` 08:02:52Z: "VERIFY PASSED … Rolled back; nothing committed."
2. `npm run db:apply` 08:03:03Z: 0269 applied, exit 0; verify:live "ALL 30 invariants hold" (append-only rules intact).
3. 99c2d148 pushed 08:03:18Z; `/api/health` served 99c2d14 from 08:05:15Z; 0 5xx in the next 10 minutes; the
   post-deploy smoke passed.
4. Production, read-only: table 2816 rows = view 2816 rows, max version 1; both functions are the locked versions;
   the view's reloptions are security_invoker=true. PostgREST
   `coaching_sessions?select=id,coaching_transcript_segments_current(count)` answered 200 with counts.
   **R2-app-embed-unproven: CLOSED.**
5. App build 30 (EAS 664f8a2f, from 328f85b8) finished 08:13Z; submission 79d62edd finished 08:14Z.
6. The stuck calls are **7 sales calls, not 12**: the other 5 were meetings, and meeting transcripts are normally
   all 'unknown' (5 of the 6 meetings in production). Marker reset on exactly the 7 (one transaction, committed on
   7 rows, 08:07:46Z). The 08:20 sweep (capped per run) took 6 of them, and **6 now have version 2**: the first
   successful replace since 2026-08-14. The re-read did not decide the rep's voice: 5 calls are a single
   'unknown' line again, 1 has 26 'unknown' lines. They need the rep's "who spoke?" answer, which now writes a
   version too. 8bde1ce2 waits for the next run.

**R1-migration-not-applied: CLOSED** (step 2). **R3-stuck-calls-not-repaired: still OPEN**: the repairs land, but
the 7 calls stay uncoachable until a rep answers who spoke, and 8bde1ce2 has not been re-read yet.

## Residual added 2026-10-03T08:55Z

```json
[
  {
    "id": "R4-undecided-recovery-loses-voices",
    "item": "When recovery cannot decide which voice is the rep it labels every line 'unknown' and stores no cluster id, so the web/app question 'whose voice is this?' relabels ALL lines one way. On a two-voice call (cef6995b has 26 lines) 'That's me' would mark the customer's lines as the rep's.",
    "why_skipped": "Pre-existing (transcriptRecovery labelFor + answerableSpeaker), not caused by 0269; the fix is to persist the diarizer's speaker id per line and ask per voice, as the upload flow does. A build of its own.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-03T08:55:00Z",
    "outcome": "OPEN. To raise with the founder as a proposal."
  }
]
```
