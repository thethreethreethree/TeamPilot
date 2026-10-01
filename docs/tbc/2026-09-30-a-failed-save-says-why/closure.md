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
