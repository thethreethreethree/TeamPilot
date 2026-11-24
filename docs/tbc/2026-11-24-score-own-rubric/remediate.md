# REMEDIATE - A score is corrected and read under its own rubric

### F1 - correcting a phone/video score recomputed it under the door rubric
rubricByVersion everywhere a score is computed or read.
gate-or-promise: gate (applyOverride.test.ts phone/video cases, mutation-checked)

### F2 - Search refused the phone-only items its own page offers
elementInAnyRubric in parseCallSearch.
gate-or-promise: gate (search.test.ts phone-only element)
