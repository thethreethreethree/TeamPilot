# CLOSURE — three rulings

## What is true now

A manager coaching a pattern reaches the rep three ways: a bell, a note on their page, and — when
a drill was assigned — a button that opens Role Play focused on that exact pattern and scores the
review on it. AWAITING REP REVIEW no longer counts people who were never told.

And the class of defect that produced this whole thread is a command:

```
npm run writer:audit
```

## The thing I got wrong before the founder corrected it

I offered three options on the gate and every one of them was a way of not writing the rule:
"not yet", "add it now and allowlist the noise", "audit once without enforcing". My stated reason
was that I did not have a precise rule.

That is a description of my position, not an argument. The founder asked for the rule.

Writing it took about twenty minutes and produced **one finding across 153 tables**, which is the
number I had guessed would be forty. The guess was doing the deciding, and I had dressed it as
caution — which is §5 exactly: the temptation is to make it *less honest* for a faster result,
and "I'm not sure this can be done precisely, here are three ways around it" is less honest than
spending twenty minutes finding out.

## The finding the new gate cannot catch, found the same hour it shipped

Wiring the bell meant opening `NotificationBell.tsx`, and it knew three notification types. I had
shipped two more that morning and was adding a third. All three would have rendered as **"A rep
closed a deal"** to a rep about a coaching note on their own pitch.

`writer:audit` cannot see this. The table has 117 writers; the gap is a **value in a closed set
that no surface renders**. So the fix is of a different kind — `text()` ends in
`assertNever(n.type)` and the union matches the CHECK, which makes a new type a compile error
instead of a wrong sentence.

The uncomfortable part is the timing. I built a gate for "schema shipped ahead of the surface"
and, in the same session, had three live instances of its sibling that the gate does not cover. A
gate narrows a class; it does not abolish the habit that produced the class. **What produced both
was shipping a migration and a writer in one commit and treating the surface as separate work** —
and no audit catches that, because at every intermediate step everything compiles and every test
passes.

## What I am relying on that nobody named

1. **The bell has never rung against the real database.** 0262 is applied and the upsert's
   `on_conflict` target exists, but no manager has written a note in production. The specific
   thing I cannot verify from here is PostgREST accepting
   `on_conflict=recipient_id,type,pattern_id` — I reasoned about why a partial index would break
   and chose a plain one for that reason, and reasoning is not a round trip. **Most likely thing
   in this build to fail first.**

2. **The drill link seeds Role Play with the pattern's LABEL, not an id.** `?focus=` takes a
   skill string, so the prospect is told to create moments for "Opens with a question instead of
   the neighborhood notice". That is a sentence written for a manager to read, and it is now also
   a prompt. It will probably work well; it has not been tried.

3. **The writer audit only sees `.from("x").method()`.** A write through an RPC that inserts, or
   through a raw `postgrest` call built some other way, reads as absent. The four false-positive
   paths I know of are covered; the ones I do not know of would show up as a finding on a table
   that does have a writer, and the honest response then is to widen the rule rather than
   allowlist the table.

4. **`scripts/` is not scanned.** Deliberate — operator tooling is not the product — but it is
   why `smoke_test_versions` needed an allowlist entry rather than passing. If a second table
   lands in that category the entry count stays informative; if a fifth does, the rule should
   probably learn about scripts instead.

## Not built, and said on the screen

- **"Schedule check-in"** — disabled with its reason, on both tabs.
- **`clip_disputed` alerts nobody.** A rep flagging a clip writes a row a manager sees next time
   they open that pattern. Same shape the bell just fixed for coaching notes, and now cheap to
   fix the same way — the column and the index exist.
- **Rude-or-dismissive flags** in Coach Assessment's "Needs your attention".

## The two mutants, and why they got opposite treatment

This build and the one before it each produced a surviving mutant, and one was deleted while the
other got a test. The rule that separates them is worth keeping:

- `shareState`'s sort tie-break **could not** affect any output — the replay records the last
  request and the last answer independently and they meet only in a timestamp comparison. Proved,
  then deleted. An inert line that reads like a safeguard is worse than no line.
- The writer audit's view exemption **could** affect output, in the case where a table is replaced
  by a view of the same name. Zero names are currently both, so it was reachable and untested
  rather than dead. It got the fixture.

Guessing which one you are looking at is how an inert guard survives and a live one gets removed.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build. No new source document was consulted; the two boards this work descends from were
opened and described earlier today.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser
— nineteenth consecutive build shipped from jsdom.

---

## Addendum — the enum ruling

### What I had to give up first

The founder's ruling was "build it, measured first", and the measurement's job is to be allowed to
say no. It did. Four versions of the inferred rule, four different false-positive causes, and the
last three survivors were **correct code** — routes that transition a subset of a state machine.

The temptation at that point is to add three allowlist entries with plausible reasons and ship a
green gate. I could have written those reasons and they would have been true. What made it wrong
was the second-order fact: **every future transition route would fire it**, so the allowlist grows
with ordinary development until nobody reads it, and the gate becomes coverage-shaped noise.

A30 says a gate must be precise or not exist. The inferred rule was not precise and could not be
made precise, because inference cannot distinguish "mirrors this column" from "shares two ordinary
words with it".

### What replaced it, and what it costs

An opt-in marker. `// enum-source: table.column` above a union, and the union must match the CHECK
exactly. Zero false positives by construction. One mirror declared today, at the site of the actual
defect.

**The honest cost:** it only protects what someone remembered to mark. It is a contract, not a
sweep. A new union mirroring a new CHECK with no marker is invisible to it — the same defect,
unguarded.

What makes that acceptable rather than an excuse: the marker is cheap, it lives at the exact place
a human decided two lists are the same, and it fails loudly when the database moves. What would
make it a lie is claiming it prevents the class. It prevents the class **where declared**.

### The parser bug, which is the finding I would want if I were reading this

The audit's first run reported the bell's four correctly-handled values as absent from the
database. The parser was line-by-line; every multi-line CHECK since 0242 was invisible. It was
confidently wrong about the one table it was built for, and the set count rose from 99 to 104 once
fixed.

That is worth more than the gate. **A new audit's first output is not evidence — it is a hypothesis
about the audit.** Both audits built today were wrong on their first run (one parsed `if` as a
table, one saw two values where there were seven), and in both cases the number looked reasonable
enough to accept. The only thing that caught them was checking individual findings by hand against
the source.

## Still not built

- **"Schedule check-in"** — disabled with its reason, on both tabs.
- **Rude-or-dismissive flags** in Coach Assessment's "Needs your attention".
- **`enum:audit` protects one union.** Every other union mirroring a CHECK is unmarked and
  unguarded. Marking them is a sweep, not a build, and it should be measured like everything else:
  each marker asserts the union IS the set, and asserting that wrongly is worse than not asserting.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
