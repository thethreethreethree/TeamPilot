# REMEDIATE

### A tap made while the phone was sending could be erased before it was sent (app)

gate-or-promise: gate

`tests/knock-store-concurrency.test.ts` races ten taps against ten removals and requires every tap to survive.
Mutation: take the lock off `addKnock` and both tests fail. The class boundary is wider than this store —
other app stores with the same read-then-write shape were not swept (residual R2).

### The phone's sweep would have let an unsupported undo block every door behind it

gate-or-promise: gate

`tests/knock-undo.test.ts` → "an undo the server cannot do YET never blocks the doors behind it". It failed on
the code as first written and passes on the fix.

### The Door Log's heads-up notice was pale on cream

gate-or-promise: declined

The existing theme audit has no concept of a pale `-300` text colour on a theme-following surface, and a
regex for it would fire on every correctly split `dark:text-*-300`. Declined per A33, hole named: a bare
`text-*-300` on a light-capable surface is caught only by photographing it, which is how this one was found.

### A comment said a mis-tap is corrected "by logging another knock"

gate-or-promise: declined

Prose cannot be gated. The claim was false because the capability did not exist; it now does, and the comment
points at it.
