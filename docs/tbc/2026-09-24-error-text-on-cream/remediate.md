# REMEDIATE

### Error text in a dark-mode red on a theme-following surface

gate-or-promise: promise

Ten sites fixed. **Not gated**, and the reason is specific rather than general.

`theme-audit.mjs` has a `paleText` category built for exactly this family — its own description
names `text-emerald-100`, `text-red-100`, `text-yellow-100` as "pale tints designed for dark,
invisible on light". It stops at `-100/200`. Every site in this build is `-300` or `-400`.

Extending that boundary is a one-line change to a regex and it is **not** a one-line decision:
`-400` is a legitimate colour on a fixed-dark surface, and this codebase has several by design —
the care radial console, the RCD sheet, the Sales Coach shell. Widening the category without first
rendering those would flag correct code, and a check that cries wolf is one people route around,
which A30 names as worse than no check.

**The promise:** a colour used for TEXT on a surface whose ground follows the theme is chosen by
reading what the token resolves to in BOTH modes, not by picking what looks right in the one on
screen. On a fixed-dark surface the same value may be correct — and "which kind of surface is this"
is a question a person answers by looking, not a regex.

Same conclusion reached about `white/N` earlier today, for the same reason: render first, then
gate, so the allowlist records things somebody looked at.

### `outcome` names five different vocabularies

gate-or-promise: declined

No fix and no gate. Every consumer is correct today, and a rename across five tables is not
something to start on the afternoon of an investor demo — the same reasoning that deferred
`closeRatePct` an hour ago, at five times the blast radius.

**What is recorded instead** is the list itself, in the capture fixture that got it wrong, so the
next person writing a fixture has the five vocabularies in front of them.

Declining honestly rather than promising a sweep I am not going to run: the fix is either a rename
of four columns or a shared type per vocabulary, and both are real projects. Saying "be careful"
would be the prose A30 warns returns.

### The fixture that produced the phantom

gate-or-promise: declined

Corrected in place, with a comment naming what it was.

No gate is possible — "is this fixture using the right enum" requires knowing which table the
component's route reads, which is exactly the knowledge whose absence caused the error. The comment
carries that knowledge to the next reader of that file, which is the most a fixture can do for
itself.

Fourth phantom today. The three before it cost minutes; this one rendered a convincing picture of a
defect that does not exist, on a screen a rep opens daily.
