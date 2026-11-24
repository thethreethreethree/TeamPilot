# BUILD - A score is corrected and read under its own rubric

No migration. No env keys.

### A manager corrects an item on a phone/video score
write-path: POST /api/coach/sales-session/pitch-score/override → readPitchScore (rubricVersion) → applyOverride →
rubricByVersion → known-item check, recompute (scorePitch with that rubric), points → apply_pitch_score_override RPC.
read-path: the score page (readPitchScore labels/order from the same rubric) shows the moved total with phone-only
items intact; the rep's alert names the item by that rubric's label; the dispute queue offers the grades for a
phone-only item (itemKindInAnyRubric).

### A manager searches calls by a rubric item
write-path: none (read).
read-path: Remote Sales → Search → element "Reason for the call" → parseCallSearch accepts it (elementInAnyRubric) →
results instead of "Unknown rubric element."
