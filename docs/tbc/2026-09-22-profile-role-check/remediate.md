# REMEDIATE — the column that decides who is an admin accepts any string

### A CHECK the enum audit cannot read

gate-or-promise: declined

`check (role is null or role in (...))` is invisible to `scripts/enum-coverage-audit.mjs`, whose
matcher wants `col in (` adjacent to the opening paren. Reordered in 0266, and the set count
moving 105 → 106 is the proof it now lands.

**The general fix is not done, and declining it is the point.** Teaching the parser to find
`col in (...)` anywhere inside a CHECK body sounds strictly better and is the third time today
that instinct would have been wrong:

- This audit's first parser read a seven-value CHECK as two, because it scanned line by line.
- Its function matcher, written this afternoon, attributed arrays from unrelated statements to
  functions that do not contain them, because `[\s\S]*?` is not a boundary.
- Both failures are the same shape: a matcher made more permissive to catch more cases, catching
  the wrong ones, and reporting a verdict indistinguishable from a correct one.

A CHECK body can contain several `col in (...)` clauses across different columns, a nested
subquery, an `or` chain joining unrelated predicates. A parser that hunts for the first one it
finds anywhere in that is a parser with a new way to be confidently wrong, and the symptom would
again be silence.

So: the constraint is written in the shape the tooling reads, and the constraint's own comment says
why. The cost is a convention someone must follow; the alternative is a parser that guesses.

**The sweep, for whoever wants the boundary:**

```
grep -n "check (" supabase/migrations/*.sql | grep -v " in ("
```

Most hits are genuinely not value sets — length, range, cross-column invariants. The question is
only whether any of them IS a set written in a shape the parser misses. Not answered here.

### The lowercase `member` row

gate-or-promise: promise

One live profile holds `'member'` where every other holds `'Member'`. Its origin cannot be traced,
because until 0266 nothing constrained the column. It is permitted by the new CHECK so that the
constraint does not break existing data, and listed on its own line with a comment saying it is
debt rather than a decision.

The promise: removing it means updating a real person's record, which is the founder's call and
was explicitly the option not chosen. If that row is ever normalised, `'member'` comes out of the
CHECK in the same migration — and then the constraint stops permitting a value that only exists
because it was once possible to write anything.
