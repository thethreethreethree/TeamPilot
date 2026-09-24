# REMEDIATE

### A mode whose exit is hidden by the mode itself

gate-or-promise: promise

The render test gates THIS instance at the right level — the escape exists and sits outside the
pager — but it cannot gate the class. "Every mode can be left from wherever it puts you" is not a
property a script can evaluate: it needs to know what a mode is, where it puts you, and which
control reverses it.

**The promise:** a switch that changes what the UI shows must have its OFF path checked from the
state it creates, not from the state it was flipped in. Turning it on and looking is the check.
Reading the toggle's code is not — and that is the whole lesson, because the toggle here is
correct and a rep is still trapped.

Concretely: when a feature flag rearranges a surface, the review question is "where is the off
switch now?", asked while standing in the new arrangement.

### A mutation that reports success without checking rows affected

gate-or-promise: promise

Five instances fixed on `profiles`; roughly 25 suspects elsewhere unverified.

Not gated, and the reason is that a gate here needs judgement a regex does not have. A service-role
client writing zero rows means something different from a caller-scoped one doing it, and a check
that flags both produces noise on the first and truth on the second. Noise is how a gate gets
ignored, which is worse than no gate — A30's standard is that it must fail without the author's
cooperation, not that it must be routed around.

**The promise:** a mutation route verifies rows affected — `.select(...)` after `.update(...)` —
and returns the STORED value, never the requested one. An echo of the caller's own input is
indistinguishable from a success.

The house already knew this. `chats.ts:1079`: *"A denied edit silently affects ZERO rows (RLS
filter, no error), so we verify the returned row."* It was written for chat edits and not
generalised, which is the same not-swept-to-the-boundary shape as everything else found today.

### The first capture's overflow was my own harness

gate-or-promise: declined

No fix and no gate — a note, because it will happen again.

Extracting a subtree (`md:hidden`) and rendering it without its parent flex chain produces layout
that looks broken and is not. The second capture, inside a 390px column, showed both controls
fitting with room.

The rule this suggests: a capture must reproduce the constraints of the real page, and a layout
defect seen only in a capture is a SUSPECT until the wrapper is proven faithful. Filed here rather
than as a residual because it is a property of the tooling, not an open item in the product — and
because the tooling is about to be used on every Sales Coach screen, where this mistake would
generate a page of findings that are not real.
