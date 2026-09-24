# REMEDIATE

### A derived artifact whose only trigger is a human deliberately asking for it

gate-or-promise: promise

**Not gated, and the honest reason is that I do not yet know how to gate it without making noise.**

The check would be: a table a product surface reads, whose only writer is reachable solely from a
component event handler. The problem is that this describes plenty of *correct* code — comments,
score overrides, disputes and every ordinary form in the product are supposed to be written only
when a human acts. A check that flags those is a check people learn to skip, which is worse than no
check, and A30's requirement is a gate that fails *without the author's cooperation*, not one the
author routes around.

Doing it properly needs an allowlist where each entry carries a reason — "this table is written
when a manager writes a comment, and that is the whole point" — so the gate's silence means
somebody thought about it rather than nobody did. That is a build, and it is item 6 of the
remediation plan awaiting the founder's go.

**The promise until then:** a feature is not complete when its table has a writer. It is complete
when something *calls* that writer without a person remembering to — or when the record says, in
words, why a human trigger is the right design for that table. `writer:audit` answers the first
question and this codebase has twice mistaken it for the second.

### The scoring path had three would-be copies of one decision

gate-or-promise: gate

`scoreSession` is the single authority; the button, `/finalize` and the drain all branch on its
returned verdict. The compiler enforces the rest: `ScoreOutcome` is a discriminated union, so a
caller cannot read `pitchId` without first narrowing on `ok`, and `REFUSAL_MESSAGE` and
`STATUS_FOR` are both `Record<ScoreRefusal, …>` — adding a refusal reason without handling it
everywhere stops the build.

That last part is a real gate and it is cheap. It is also what caught the extraction's own bug:
`PitchScoreFailure` is a strict subset of `ScoreRefusal`, so the widening needs no cast and a fifth
failure reason added upstream would fail to compile here.

### A refusal's wording rebuilt downstream from its reason code

gate-or-promise: declined

No gate. The verdict carries its sentence, and the three tests that caught the regression
(`refuses a huddle`, `refuses a meeting`, and the suppressed status assertion) stand as the guard.

Declining rather than inventing something: a check for "does any consumer re-derive a message from
an enum" would have to distinguish that from every legitimate label lookup in the product, and I
would be building it to look thorough. The existing tests fail loudly and by name, which is what
the gate would be for.

### suppressed returns 502 where 409 would describe it better

gate-or-promise: declined

Left exactly as it was. Guidance being off is an account state, not an upstream fault, so these
appear in error monitoring as failed dependencies and dilute real 502s.

Not changed here because it is a wire-visible behaviour change nobody asked for, inside a build
about reachability, and the existing test asserts 502 deliberately. Recorded so it is a decision
someone can take on purpose later rather than a detail that silently stayed wrong.
