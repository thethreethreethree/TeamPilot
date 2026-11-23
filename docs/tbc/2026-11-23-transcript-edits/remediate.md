# REMEDIATE - Editable transcripts

### F1 - the AI-written summary and review keep the earlier words
Stated on screen after every save, with the existing regenerate controls on the same page.
gate-or-promise: promise (OPEN.md "transcript corrections do not redo the AI summary and review")

### F2 - a corrected line is not re-timed
Line times are kept; a line is still placed on the recording where it was spoken.
gate-or-promise: promise (OPEN.md "a corrected line keeps its times")

### F3 - two gate catches before commit
Allowlisted with reasons in scripts/rls-audit.mjs and RAW_TRANSCRIPT_USES (count 1, so a second base-table read in the
route fails).
gate-or-promise: gate (rls-audit and invariant-audit INVARIANT 32, both in npm run check)
