# BUILD - Assign pickers list only reps the manager may assign

No migration. No env keys.

### A manager opens Assign on a course or scenario
write-path: none (the assign routes are unchanged and still check the tree).
read-path: GET /api/coach/remote/assignable-reps → active profiles in the company → treeFilterRepsChecked (null → 503) → without the manager → names → the picker chips.
