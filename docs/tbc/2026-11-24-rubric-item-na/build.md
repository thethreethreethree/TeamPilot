# BUILD - A manager can mark a rubric item "Doesn't apply"

Migration 0331_rubric_item_na.sql (applied; DB at 0331). No env keys.

### A manager marks an item N/A while answering a dispute
write-path: Coaching → disputes → "Correct it: Doesn't apply to this call" + note → POST
/api/coach/sales-session/pitch-score/override {newValue: "na"} → applyOverride (rubricByVersion; section_all_na
guard) → scorePitch (section scaled over what applied) → apply_pitch_score_override (element row grade 'na', 0 points;
override row; new totals).
read-path: the score page shows the item as "N/A" and the section at its scaled value; the rep's alert names the item
and the new total; team rates and pattern history leave the item out for that pitch.
