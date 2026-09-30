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
