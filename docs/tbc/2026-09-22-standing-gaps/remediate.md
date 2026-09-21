# REMEDIATE

### F1 — the rounding comment named an example that does not misbehave

fix: the real case was found by search rather than by intuition — `100.1 - 100` is
  `0.09999999999999432`, and it is a NEAR-TIE, which is where a rep reads the number hardest. The
  comment and the fixture both say that now.
gate-or-promise: gate. The "no rounding" mutation fails against the corrected fixture, which it
  could not do against the old one. What makes this durable is that the fixture is now the case the
  code exists for, rather than a case that merely looked like it.
residual: the general class — a numeric comment that asserts a float — is not gated. `node -e` on
  the literal pair is the whole check and takes seconds; it is recorded in check.md as a command
  rather than as a habit.

### F2 — the "Metrics" tab has no page in the sheet

fix: nothing was built. The tab is recorded as needing the founder's contents.
gate-or-promise: declined, with the hole named (A33). Nothing mechanical can tell a nav label from
  a specified surface — both are words in a design. The narrower guarantee is the one this build
  demonstrates rather than promises: the sheet was extracted and its PAGE STRUCTURE compared
  against what the summary claimed, before anything was written, and that comparison is recorded as
  a sweep command. The hole is that it depends on remembering to look, which is precisely what
  failed one build ago and was caught one build later.
residual: my own status artifact still lists surfaces derived from labels rather than from the
  sheet. It has been corrected for this row; the others were not re-checked against the PDF.
