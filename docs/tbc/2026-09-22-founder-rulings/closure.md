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
