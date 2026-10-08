# CLOSURE — a failed save says why, and stops paying

## What is true now

When a score cannot be saved, the manager reads that the recording **was graded**, that the fault is ours, and,
if it happens twice in a row, that the run stopped rather than keep paying. On 09-26..28 the same failure cost
164 gradings and said only "could not be saved". The panel's refusal lines now read as sentences.

## The finding

**A `null` that means two things cannot be acted on.** The remedy for "this grading had no evidence" is to try
again. The remedy for "the database refuses every save" is to stop. Merged, the only safe behaviour was the one
the code already had, which was to keep going, and that is what spent the money.

## Residual

```json
[
  {
    "id": "R1-first-stored-score",
    "item": "No pitch score has yet been stored in production; 0268 and this change are both unobserved live.",
    "why_skipped": "It needs a grading run, which spends model credit on production. A manager pressing Score them all is the founder's action.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-30T02:40:00Z",
    "outcome": "OPEN. After the press: pitch_scores > 0, and no pitch_scores_rubric_version_fkey lines in the logs."
  },
  {
    "id": "R2-null-return-sweep",
    "item": "Other Promise<string | null> returns in src/lib/coach have not been checked for merged causes.",
    "why_skipped": "Named in check.md's sweep; separate build.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-30T02:40:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended 2026-10-01

R1-first-stored-score: CLOSED. 52 scores stored on 2026-09-30 between 20:02 and 20:52Z (read-only query
2026-10-01T04:09Z), so the save path works end-to-end after 0268.

Observed while checking them, recorded here rather than acted on:

- 6 of the 52 came from recordings where the rep said 1 to 6 words; each was graded on all 29 elements and
  scored 0 to 16 (none qualify). Founder, picker 2026-10-01: "Keep scoring everything". No change.
- `duration_s` is the saved audio's length (`audioDurationSeconds`), not the conversation's: one qualifying
  pitch shows 3 s against a 413 s session with 137 rep words. Whether its saved audio is truncated could not
  be determined: transcript segments carry no usable `spoken_at`, and 350 of 369 finished sales sessions have
  no saved audio file. OPEN question, not a finding.

## Appended 2026-10-01 — "350 sessions with no saved audio", explained

Read-only, production, sales sessions ended or reviewed (369). The 20-per-rep retention (recording-purge-cron,
founder 2026-08-26) explains the older ones. Inside each rep's newest 20 (150 sessions), 137 have no audio:
130 are from the weeks of 08-10 and 08-17, purged under the earlier 2-day rule that 08-26 replaced; the other
5 (since 08-24) are empty sessions with 0 transcript segments and no audio length, started and ended with
nothing said. Missing audio is retention and empty sessions, not a storage fault. Still open: the one pitch
whose saved audio is 3 s against a 413 s session with 137 rep words.

The 3 s pitch is session 8e0905d6 (2026-08-12); its audio was purged under the old 2-day rule, so it cannot be
examined. For the 19 sessions that still have audio, `ended_at - started_at` runs 6-7 hours on recent ones
(left open, closed later by auto-close-stale-cron), so session length is not conversation length and cannot
reveal truncated audio. The short files that exist (7 s, 9 s) have one transcript line each: short recordings,
not truncated ones. CLOSED as not reproducible, with no recent instance. Side observation, not acted on: any
metric that reads a sales session's ended_at as when the conversation ended will read hours of idle time.

## Residual update (appended 2026-10-08T18:00Z)

- **R1-first-stored-score: CLOSED.** Production, read-only: pitch_scores holds 52 rows, written 2026-09-30
  20:02:51Z to 20:52:32Z, after 0268. Storing works live.
