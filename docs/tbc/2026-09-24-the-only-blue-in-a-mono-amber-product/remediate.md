# REMEDIATE

### Native controls with no accent colour

gate-or-promise: promise, with a gate DECLINED for a stated reason

The convention exists and is ten call sites old. A gate is tempting and I am not writing one,
because the two legitimate exclusions found here are exactly what it would get wrong:

- `RecordingsTab`'s scrubber already has the class — a gate would pass it, fine.
- `WowDifferentiator`'s range is `opacity: 0` with `appearance: none` in a CSS module, laid over a
  custom divider. **A gate reading JSX cannot see a CSS module**, so it would demand an accent
  colour on a control that has no visible surface to colour.

One false positive out of six is a 17% wolf rate on a class whose worst outcome is "a control is
the wrong colour". A30's test — would the check be routed around? — says yes, and quickly.

**The promise:** a native `<input>` of type range, checkbox or radio carries `accent-ember-400`
unless it is visually hidden or fully custom-styled, and "fully custom-styled" has to be
demonstrated from the CSS, not assumed from the presence of a `className`.

### A scanner that reported 18 for a class of 5

gate-or-promise: promise, and it is the same promise as the previous build with a second instance
behind it

Two builds, two scanners, two wrong numbers:

- the wrong-namespace probe reported **0** for a class with 56 members;
- this one reported **18** for a class with 5, by truncating JSX elements at the first `>`, which
  in this codebase is almost always inside an arrow function.

Both were caught the same way — by reading the members. Neither cost anything because the reading
happened before the reporting.

**The promise, now stated as a rule rather than an observation: a count is not a finding.** The
finding is the members, and the count is a claim about how many there are. Reading six elements
took under a minute; writing the scanner took longer than that, twice.

### The debt this build existed to pay

gate-or-promise: promise

The previous closure named `/calibration` as unrendered while a change had been made to it. This
build rendered it and the change was correct.

**The promise: a residual that names a weaker claim is a commitment, not a disclaimer.** "Fixed by
pattern, not seen" is only honest if the seeing eventually happens; written and then left, it
becomes a tidier way of not checking. Three entries in today's residuals are still of that kind —
the four checkboxes here, the non-Sales-Coach sites from the previous build, and `RepActivity`.
