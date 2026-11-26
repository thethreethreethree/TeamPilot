# BUILD - Training is only assigned to active people

No migration. No env keys.

### A manager (or a direct call) assigns training
write-path: POST /api/coach/remote/assignments or /course-assignments → tree check → profiles in the company AND status active → assignments for those only; none left → 403.
read-path: the picker's roster (/assignable-reps, active only) → the same people.
