# Think2 — How We Build Here (Part 2: Hard-Won Lessons)

> Moses — Think1 was the rules. Think2 is the lessons *behind* the
> rules: real mistakes people made here, and what they teach. You'll
> understand the rules better once you see why each one exists. Read it
> once now; come back when you hit one of these situations for real.

Each lesson has the same shape: a mistake that's easy to make, and the
deeper truth it points to. None of these are about being smart. They're
about being honest and careful.

---

## Lesson 1 — "It's saved" is not "they can see it"
You can save data correctly and *still* have a broken feature, because
the screen that's supposed to show it is reading the wrong thing. The
data path and the screen path are two different things. **Always check
the actual screen**, not just that the data was written. Open the page.
Look. If there's more than one view (a small card and a big view, a
phone and a desktop), check each one.

## Lesson 2 — When the same bug keeps coming back, your diagnosis is wrong
If you fix a bug, and it comes back, and you fix it again, and it comes
back again — the problem is not the bug. The problem is that you've
misunderstood what's actually causing it. Stop adding patches. Step
back and ask "what is *really* going on here?" The repeating bug is a
message: *you have not understood the cause yet.*

## Lesson 3 — A database change must be safe to run twice
When you change the database, write the change so that running it a
second time doesn't break. Assume it might get run again, or that it
half-ran last time. (The Coach will show you the exact patterns —
"if it already exists, skip it.") A change that only works on a
perfectly clean database is a trap waiting to spring.

## Lesson 4 — A write that "succeeds" but changes nothing is a silent lie
Sometimes you tell the database to update something, it returns no
error, but it actually changed *zero* rows (because you weren't allowed
to, or nothing matched). No error does NOT mean it worked. **Check that
something actually changed**, not just that nothing complained.

## Lesson 5 — The same feature should work the same way everywhere
If the product has "upload a file" in three places, those three should
behave the same. When the same idea works differently in different
spots, users get confused and trust drops. Before you call a feature
done, ask: "does this match how the same thing works elsewhere?"

## Lesson 6 — A feature that works alone but breaks the flow isn't done
Your button can do exactly what it's supposed to and the feature can
still be broken — if it leaves the person stuck, staring at a blank
screen, with no obvious next step. Think about what the person does
*right before* and *right after* using your feature. Leave them able to
keep going, not stranded.

## Lesson 7 — Don't claim the discipline while skipping it
It's easy to *say* "I understood it, I tested it, I checked the
neighbors" without actually doing those things. Saying the words is not
doing the work. The point isn't to sound careful — it's to *be*
careful. If you didn't test it, the honest move is to say "untested,"
not to imply it works.

## Lesson 8 — Surface, don't take over
When something seems blocked or confusing, don't silently force your
own way around it. Surface it — say "this is blocked, here's why, here
are my options." Then ask. Quietly substituting your own structure for
what was asked is how small mistakes become big ones nobody caught.

---

**The thread through all of these:** *the mistakes that hurt most are
the ones where the work looked done but wasn't, because a step was
skipped quietly.* Slow down at exactly the moments you're tempted to
rush. The Coach is there for those moments — lean on it.
