# REMEDIATE

### F1 — the two definitions I was about to invent were both wrong

fix: the sheet's text was extracted with `pdftotext -layout` and the captions used verbatim. Each
  definition that is still inferred says so in the module.
gate-or-promise: gate, and a narrow one. Twelve mutations encode the definitions directly — "Clean
  sweep = no violations" and "Full bundle = any three bonuses" are both now failing tests, so the
  wrong readings cannot return silently. What is NOT gated is the general case: nothing forces the
  next person to open the PDF rather than the map that summarises it.
residual: the map paraphrases the sheet in several rows. It is an index and reads like a
  specification, which is the same shape as A22's warning about citing an asset from its labels.
  The sweep command is recorded; the rows were not individually re-checked against the PDF.

### F2 — a test regex was silently corrupted into a control byte

fix: the assertion is a plain `toContain`, and a repo-wide `grep -rlP '\x08'` confirmed no source
  file carries the byte.
gate-or-promise: declined, with the hole named (A33). A lint rule banning control characters in
  source would catch this class, and it is not added here: it is a repo-wide tooling change made in
  reaction to one incident during an unrelated build, which is how a noisy gate gets introduced and
  then ignored (A30's own constraint). What replaces it is the recorded sweep command. The hole is
  real — the dangerous version of this mangling is one that still matches something.
residual: this is the fourth time an escape has been mangled writing files this session. The
  pattern is heredocs and non-raw Python strings; the workaround has been file-based scripts, and
  it has failed anyway.

### F3 — a fixture generated dates that do not exist

fix: `Date.UTC` timestamps, with a comment saying what the earlier fixture did and why a string
  sort hid it.
gate-or-promise: declined. Nothing mechanical distinguishes a fixture that is wrong from one that
  is unusual, and `2026-03-50` is a string a type system is happy with. The narrower guarantee is
  that this test now fails if the derivation stops sorting — mutation M7 — which is what the
  fixture existed to check in the first place.

### F4 — a guard that guarded nothing

fix: removed, with the reasoning left in its place.
gate-or-promise: promise, and a small one. The practice is the gate: a surviving mutant is treated
  as a finding until a control proves equivalence, and when it IS equivalent the next question is
  whether the code it survived on should exist. That question found this line. It is a habit, not a
  check, and it will hold exactly as long as mutation testing is run by hand.
