# REMEDIATE — the design was the specification, and five parts of it were not built

### A build reported complete with five specified parts missing

gate-or-promise: declined

Project 4 shipped and was reported done. The founder asked "did you build this?" of their own
design and the answer was "most of it", which is the §1.5.4 under-deliver failure — the mirror of
overtaking, and the one that is harder to notice because nothing looks broken.

Four of the five are now built and pinned by render tests. That is the instance.

**The class cannot be gated, and pretending otherwise would be the more comfortable lie.** A check
that "the build matches the design" would need to compare a rendered page to a PDF. What a test can
assert is the strings the same commit put there, which pins against regression and says nothing
about conformance — a tautology one step removed.

What would have caught this at the time is not a gate either. It is opening the design and reading
it line by line before declaring the build done, which is the discipline the Evidence Protocol
already states and which I did not apply to Project 4. Writing that down is worth more than a
check that would pass whatever the screen looked like.

### A gap list built from greps, with two wrong rows

gate-or-promise: promise

My first list of differences had six rows. Two were false: `KEY MOMENTS` and `TRANSCRIPT AT 7:22`
are built, rendered by `Key moments` and `Transcript at {clock}` with an `uppercase` class. A third
row — "Rank #5 this week" — was the build being correct and the design being a snapshot.

So half the list was wrong, and the founder had it before I checked.

**The promise:** a claim about what a surface renders comes from reading the JSX, not from grepping
for the string. `&apos;`, `uppercase`, `capitalize`, template interpolation and split JSX text nodes
all break a literal match, and every one of them produces a FALSE NEGATIVE — the confident kind,
where the grep returns nothing and nothing is what you report.

No gate: a linter cannot know which strings are meant to be user-visible. The habit is the control,
and the tell is a grep returning nothing for a string you can see on the screen.
