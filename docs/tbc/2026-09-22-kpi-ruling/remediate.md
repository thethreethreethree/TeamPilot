# REMEDIATE

### F1 — the fixture put the rep last, where the cushion is null anyway

fix: a three-rep board with the rep in the middle, so there genuinely is someone 45 points below.
  The test asserts `gaps.ahead` is null AND that 45 appears nowhere in the payload — the second
  half is what makes it a test about withholding rather than about a default.
gate-or-promise: gate for this case. The "send a rep the cushion below" mutation now fails, and it
  could not before. The broader class — an assertion that a value is absent, against a fixture that
  would produce absence anyway — is **not** gated, and this is the third instance in three builds
  (the Century fixture, the bell's failed-read test, this one).

  What the three have in common is worth writing down: each asserted a NEGATIVE, and a negative
  assertion passes for free unless the input makes the positive possible. The question that catches
  all three is the same one — *does this fixture make the wrong answer reachable?* — and it is
  prose, which A30 says returns. What actually caught all three was mutation testing, run by hand.
residual: no other negative assertions in this feature were re-checked against that question.

### The ruling itself is not a finding, and needs no remediation

Nothing was defective. Two behaviours I had chosen were overturned by the person entitled to
overturn them. The build applies the ruling and records it in section L.

What DOES need naming, and has no fix here: **the class is "resolved a conflict between two
authorities instead of escalating it", and nothing structural catches it.** The decision-picker
guard fires on a message that offers a choice in prose — it fired on mine, correctly — but it
cannot fire on a decision that was never offered at all. Three conflicts were resolved silently and
recorded as careful reasoning; the guard saw none of them, because by the time anything reached the
founder it was a finished behaviour with a paragraph explaining itself.

gate-or-promise: declined, with the hole named (A33). A gate would have to recognise that two
documents disagree, which is a semantic judgement about prose. The nearest mechanical thing —
flagging any closure entry that says "my inference" or "a concession" — would be gameable by
phrasing and would train me to phrase around it, which is worse than nothing. The honest guarantee
is a practice, stated so it can be checked: **when two authorities in the tree disagree, the
picker fires before the code is written, not after the third one is noticed.**
