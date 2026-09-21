# REMEDIATE

### F1 — the correction row crashed the whole pitch panel

fix: `(pitch.overrides ?? [])` at all three access points, and a test whose fixture has the field
  **deleted** rather than set to `[]` — an empty array proves nothing about a payload that never
  carried the key.
gate-or-promise: gate, at the level this defect actually lives. The test fails without the guard
  (mutation-confirmed), so the specific crash cannot return. The broader class — `as T` on a
  `res.json()` result — is **not** gated, and that is stated rather than implied: there is no check
  in this repo that a cast across a network boundary is honest, and writing one means runtime
  validation at every fetch site, which is a decision with a real cost and is the founder's to
  make. The sweep command in check.md is the manual boundary until then.
residual: `pitch.disputes` has the identical exposure and is not guarded. It shipped before its
  server did, so the window has already closed in practice — but the asymmetry is now visible in
  one file, which is worse than either state alone. Named here rather than fixed in passing.

### F2 — the grade-label test pinned one grade out of three

fix: all three grades asserted in a single render.
gate-or-promise: gate. The hard-coded-label mutation now fails. The generalisation — *assert every
  member of a closed set, not a sample* — is prose and will return; what makes it survivable here
  is that the sets are small and defined in one place (`GRADE_STYLE`, `VALUE_OPTIONS`), so a new
  member is added next to the labels a reader is already editing.

### F3 — no test ever sent a bonus correction

fix: a bonus case asserting the route receives `itemType: "bonus"`.
gate-or-promise: gate for this component. The declined half, named: nothing forces a suite to
  cover every branch of a union it exercises, and a violation fixture is still absent here — the
  violation path shares `VALUE_OPTIONS` and the same `itemKindOf` lookup as the bonus path, so the
  bonus case does constrain it, but not directly. That is a coverage claim by argument rather than
  by execution, which is the thing this file exists to be honest about.

### F4 — a constraint I invented was sitting in the tree looking ratified

fix: kept in the file as a SUPERSEDED CONSTRAINT with its reasoning; recorded in full as section K
  of `LOGIC-AND-CONTRADICTIONS.md`; the one instruction that had become actively misleading
  (*"Re-score the pitch if the grade was wrong"*) removed, with the reason written beside the test
  that asserted it.
gate-or-promise: declined, with the hole named (A33). A gate would have to distinguish a rule that
  cites a source from a rule that makes an argument, and both are prose in a docblock — no
  mechanical check separates them, and a naive one (grep for MUST NOT) would flag every correct
  constraint in the codebase and train everyone to ignore it, which is A30's noisy-gate failure.
  What replaces it is narrower and real: this class is now **on the record with a name** in
  `LOGIC-AND-CONTRADICTIONS.md` alongside the four duplicated-decision instances, and the
  distinguishing question is written down — *does this rule name a source, or make an argument?*
  The hole is that the next invented constraint will also read as reasoned, and only the founder
  or the spec will catch it.
