# 06 — VERIFICATION

Read before claiming anything works.

The constitution already forbids reporting untested work as done. This file is
the *technique*: what verification actually looks like, and the specific ways it
goes wrong while feeling thorough.

---

## 1. The four levels, in order of strength

| Level | What it proves | Trap |
|---|---|---|
| It compiled | Syntax and types | Nothing about behaviour |
| The screen mounts | The navigation target rendered | Renders blank, crashes on first interaction, wrong data |
| The UI shows the right thing | The render path works | The data may not have persisted |
| **The data landed AND the UI shows it** | The feature works | — |

**Only the fourth counts.** Both halves, every time.

The failure has a name: *data path complete ≠ render path complete.* State can
hold the right value while the view reads a different field. The view can look
perfect while nothing was written.

And on a device, "the feature works" has more than one axis. A feature verified
only on one platform, only with permissions granted, and only with the network up
is half-verified. Verify it on **iOS and Android**, on the **permission-denied**
path, and **offline** — and do the fourth-level check on a real device, not only
a simulator, because that is where the data actually lands.

---

## 2. Test the class, not the case

One passing example proves one example. Where a function takes a range, sweep the
range and assert an **invariant**.

A tier-pricing function looked correct at every value spot-checked by hand. Swept
across the full range it was **non-monotonic** — a larger quantity cost less than
a smaller one — and that only surfaced because the sweep asserted a property
rather than comparing a few outputs.

Good invariants: monotonic where it should be · never worse than a baseline ·
two derived outputs agree · idempotent operations produce identical state.

---

## 3. Your own test is the most likely thing to be wrong

Three false results in one build, all mine, all the same shape: **the assertion
was weaker than it looked.**

- A selector matched two elements (`Name` also matched `Hotel name`) and the run
  died on ambiguity.
- "The last button in the form" was the *dismiss* button, not the submit. The
  test clicked cancel and reported no confirmation.
- A check for a lowercase string failed because the rendered text was
  uppercased by a text transform, and the accessibility label returns the
  transformed text.

The discipline:

- **Confirm the surprising result before believing it.** When a test says a
  feature is broken, check whether the *test* is broken first. In all three cases
  above, the feature was fine.
- **Assert on what the user perceives** *and* on the underlying record. If the UI
  claims success, go and read the row.
- Prefer exact, role-based selectors. Enumerate a screen's buttons before tapping
  one.
- Never report "broken" from a single weak signal.

---

## 3b. If a human will look at it, look at it once yourself

The four levels above all assume the output is something you can assert *about*.
Some output is only judgeable by eye, and for that the whole table is blind.

A generated image — exported for a share sheet, or rendered as a store screenshot
— was written to disk at the right size in the right format. Opened, it read
`home.hero` in 82-point type — a translation key that did not exist, echoed back
verbatim by the lookup. **No file-size or format check could ever have caught
that.**

The same failure in the other direction: a layout audit reported the screen fit
within its safe area while a row of tab labels was visibly clipped at the screen
edge. The checker measured the one thing it knows how to measure, and reported
clean.

**The rule.** Anything whose correctness is visual — a generated image, a store
screenshot, a PDF, a chart, an email, a screen on a new device size — gets looked
at once before you call it done. One screenshot. It costs seconds and it is the
only check that sees what the reader sees.

This does not replace §1. Look **and** read the row.

---

## 4. Measure instead of eyeballing

Anything with a number should be measured:

- **First screen** — read bounding boxes against the screen height, inside the
  safe-area insets, at each device size.
- **Layout shift** — observe it, do not infer it from the layout tree.
- **Layout on the smallest device** — check the content holds within the safe
  areas on the smallest supported screen; do not judge it from a big simulator.
- **Contrast** — compute it; do not judge it by eye.
- **Responsiveness** — measure on a **real mid-range device**, not just a
  simulator on a fast Mac, so you can tell the app apart from your own hardware.

A screenshot proves what one screen looked like on one device at one moment.
Numbers are how you know whether it holds.

---

## 5. Gates: what they do and do not tell you

**A green gate is necessary and never sufficient.** Automated accessibility
tooling catches roughly a third of real failures. Contrast, name/role/value and
labels are reliable; focus order, meaningful alt text and error-recovery flows
are not.

**A skipped gate is not a pass.** If a check did not run, the build is unverified
in that dimension. Say which, in the first sentence.

**A warning is not automatically a defect.** Heuristics produce false positives.
When you believe one is wrong, *prove it with a measurement*, record the evidence,
and move on — do not silence it, and do not cargo-cult a fix that makes the
checker happy without making the product better.

**A failing gate is not automatically a defect either** — but the burden is on
you, and the evidence must be a measurement, not an opinion.

---

## 6. When a checker blocks you

The rule from the constitution: never weaken a rule to make a gate pass. That is
tampering, and it is the one action the system treats as fatal.

But blocked is not always the same as wrong. Sort it:

1. **The rule is right and the code is wrong** → fix the code. Most cases.
2. **The rule is right and the *markup* was wrong** → often the real answer. A
   text-length warning on a price is telling you a figure was rendered as a
   paragraph instead of a labelled value.
3. **The rule genuinely does not apply here** → use the sanctioned escape. Rules
   usually have one: an exempt path, a documented waiver. Take the sanctioned
   route and write the justification.
4. **The tool is broken** → see §7.

What you never do: restructure code purely to dodge a detector while leaving the
underlying problem. If the fix does not make the product better, it is the wrong
fix.

---

## 7. When the tool itself is broken

Distinguish two cases sharply:

- **Weakening a rule so a gate passes** — forbidden, always.
- **Fixing a defect that stops the gate running at all** — sometimes necessary. A
  gate that cannot execute provides no protection either.

If you must fix the tooling:

1. Diagnose and state the root cause precisely.
2. Change the minimum. Never touch a threshold.
3. **Prove the gate still bites** — run it against deliberately broken input and
   confirm it still fails. This is the step that separates a repair from a
   defanging.
4. Disclose it prominently and record it where the owner will see it.

---

## 8. Cleaning up after yourself

Test data written during verification gets removed, and the removal verified.
Leaving fabricated bookings or customers in a client's database is its own
integrity failure — and it corrupts the very counts the owner will use to judge
whether the thing works.

---

## 9. What to say when reporting

- Name what you verified **and how**.
- Name what you did **not** verify, without being asked.
- Distinguish measured facts from judgement, and label the judgement.
- Correct your own earlier claims plainly when evidence overturns them. A
  correction stated once is worth more than a caveat repeated five times.
