# REMEDIATE

### F1 — a test that could not fail, found by mutation for the fourth build running

fix: the unhandled key is pressed from the Metrics tab rather than from Progress, and the test
  asserts both that Metrics stayed AND that Progress did not appear. The fall-through mutation now
  fails.
gate-or-promise: gate for this case; **declined for the class**, with the hole named (A33).

  Four fixtures in four builds have now asserted something against an input that made the wrong
  answer unreachable — the Century dates, the bell's failed read, the leaderboard cushion, and this
  one. All four read well. Each names in its title exactly what it means to guard, and each was
  wrong about whether it did.

  A gate would have to decide whether a fixture makes a defect reachable, which is the halting
  problem wearing a hat. What actually catches them is mutation testing, run by hand, on the units
  I choose to mutate — so the rate of four is a **lower bound**, not a count.

  The one durable thing is the question, written down so it can be asked rather than remembered:
  **does this fixture make the wrong answer POSSIBLE?** It applies to every assertion of
  "unchanged", "absent", "null" or "not called".
residual: no other negative assertion in this feature was re-checked against that question.

### The density pass is not remediation and should not read as it

It found one thing and fixed it. It is recorded in build.md rather than as a finding because
nothing was defective — the sentence was true, and had stopped being true *of the reader*.

What it did NOT do is named in check.md: it cannot find a layout problem, because it is a read of
markup. The founder chose it over a browser check having been told that. Eight builds have now
ended with nothing rendered.
gate-or-promise: declined, and deliberately so. There is nothing to gate: no defect occurred, and
  the change was one sentence becoming conditional. Encoding "audit the screen after a behaviour
  change" as a check would mean detecting that copy has stopped applying to its reader, which is a
  judgement about meaning rather than about code. What replaces it is the practice the founder
  chose and its stated limit, both in check.md.
