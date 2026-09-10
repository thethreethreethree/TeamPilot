# 08 — LESSONS

Real mistakes from a real build that shipped. Read once, early. Each one cost
time, and each is cheap to avoid if you know it is coming.

They are grouped by the shape of the error, because the shape recurs even when
the specifics do not.

---

## Shape 1 — Trusting a document about live state

**What happened.** The runbook said a port range was free. Three ports in it were
in use, by services the document never mentioned. Following it would have
collided with a running application.

**Why it happens.** Documents record a moment. Servers move on. Nobody updates
the table when they add a service.

**The rule.** Re-derive live state from the machine, every time. Ports, versions,
what is running, what is exposed. Treat every inventory in a document as a hint,
never as fact — and report the drift, because the next agent reads the same
table.

**Generalises to:** dependency versions, framework and native-module APIs,
anything where your training data or a stale doc might disagree with the installed
reality.

---

## Shape 2 — Changing two variables and blaming the wrong one

**What happened.** Display type was set to maximum weight *and* a widened width
axis. Told it looked "comically bold and stretched", both were changed at once —
the result was limp, and had to be walked back.

**The actual cause** was the *stretch*, not the weight. Rendering the same weight
with and without distortion made it obvious in seconds.

**The rule.** When feedback names a symptom, isolate the variables before acting.
Change one, look, then the next. And when the fix overshoots, that is evidence you
changed the wrong thing — not evidence you should split the difference.

**Cheap technique:** render candidates side by side, including the current
setting as a row. One image ends the argument.

---

## Shape 3 — Checking the surface instead of the record

**What happened.** A cancellation-request feature was tested by tapping a button
and matching text on the screen. The database said no request had been stored. The
conclusion drawn — "a real defect" — was wrong: the test had never submitted the
form.

**The rule.** Verify both halves: the record, and the rendered surface. When a
test reports failure, suspect the test first. Confirm the surprising result
before acting on it.

**Related.** Three separate false results in one build came from weak selectors —
an ambiguous label, the wrong button in a form, and a case-sensitive match against
text that a transform had uppercased.

---

## Shape 4 — Deferring a dependency and never returning

**What happened.** Asked to source photography, the answer was "after the
direction is locked" — a defensible sequencing decision. Then it was never
revisited. The client saw an app full of empty image panels and called it a
disregard of instruction, correctly.

**The rule.** A deferral is a commitment with no due date attached. Either do it
now, or write it where it will be seen again — a launch blocker, a checklist item,
a task. "I'll come back to it" is not a mechanism.

**Also.** Own it plainly when it happens. One sentence, no ceremony, then fix it.

---

## Shape 5 — Optimising a subproblem instead of the whole

**What happened.** Tier pricing was implemented as division plus remainder. It
looked right on every hand-checked value. Swept across the full range it was
**non-monotonic** — six weeks cost more than two months — because it never
considered rounding *up* to a cheaper tier.

**The rule.** When a computation chooses among options, ask whether it is really a
*covering* or *optimisation* problem rather than an arithmetic one. Then assert a
property over the whole range, not a handful of outputs.

---

## Shape 6 — The framework did something you did not ask for

**What happened.** A screen that read live data worked in the dev client but
shipped showing a stale, build-time snapshot — the bundler had inlined a value
that should have been read at runtime. An owner editing a price would never have
seen it change in the release build, and it would have presented as an
inexplicable caching bug.

**The rule.** Read the build output. When it labels something in a way that
contradicts what the screen does, that is the framework telling you about a bug.

**Related surprises worth expecting:** a dynamic class name that a utility
framework never generates because it only scans literal strings; a native module
that works in the dev client but is dropped or broken by the release bundler; a
migration that never runs because the connection was cached.

---

## Shape 7 — The guard is right even when it is inconvenient

**What happened.** A write was blocked for hardcoded colour literals in a file
that genuinely could not read the theme. The reflex was to request an exemption.
The actual answer was to import the token module, which was one line and removed
the duplication entirely.

**The rule.** When a guard blocks you, work through the ladder in
`06-VERIFICATION.md` §6 before reaching for an exemption. The block is often
pointing at a better design, not standing in front of one.

**And:** never route around a guard by using a tool it does not watch. If a
permission asks for approval on a path, do not reach the same path another way.

---

## Shape 8 — Fixing the tool versus defanging it

**What happened.** A gate could not run at all on this platform — a path-handling
defect made it crash before executing. Fixing it meant editing the enforcement
machinery, which the constitution treats as the most dangerous action available.

**How it was resolved.** Fix the minimum. Change no threshold. Then **prove the
gate still fails on deliberately broken input**, and disclose the change in
writing.

**The rule.** "Weakening a rule so a gate passes" and "repairing a gate so it can
run" are different acts. The proof that you did the second is that you
demonstrated it still bites.

---

## Shape 9 — Reporting that sounds thorough but is not

**What happened.** A screen took ten seconds to appear on the simulator and looked
broken. Reporting "it hangs on load" would have implied a fault in the app. The
real cause was a cold bundler compiling the JS on first open and a busy dev
machine — on a real device with a warm bundle it was instant.

**The rule.** Separate *your* environment from *the system under test*. Measure
from both sides before attributing a fault. And when you have already stated
something incorrectly, correct it in one plain sentence and continue.

---

## Shape 10 — Delivering a subset when the whole was asked for

**What happened.** The instruction was a backend that lets a client manage *their
graphic assets*. What was built managed the photographs and left the brand
identity in code — the logo on every screen, the app icon, the adaptive icon, the
splash screen, the store screenshots. Told "I did not say some", the correction
was **still** a subset: two slots, chosen by the agent. It took a third pass to
enumerate the set properly.

**Why it happens.** Reasoning about a category produces the members you can
already name. It cannot produce the ones you have forgotten, and it never produces
the ones you never knew about.

**The rule.** When the instruction says *all*, **enumerate mechanically before you
design**. Sweep the filesystem, the imports, the app config, the asset directory.
Show the owner the inventory and let them see it is complete, rather than asking
them to trust that it is.

**What the sweep found that reasoning had not:** five unused files from the
framework's own starter template, still bundled into the shipped app — including
the toolchain's default icon and splash screen.

---

## Shape 11 — A clean export is not a look

**What happened.** A generated image — exported for a share sheet, or rendered as
a store screenshot — was written to disk at the right size in the right format,
and was reported as working. Opened as an image, it read `home.hero` in 82-point
type — a translation key that did not exist, which the translator echoes back
verbatim.

**Why it happens.** Every automated signal was green. The write succeeded, the
format was correct, the size was reasonable. Nothing in the output could have
revealed the defect.

**The rule.** For anything whose output is *visual* — an image, a store
screenshot, a rendered screen — **look at it**. One screenshot. The same applies
to a layout audit that reports the screen fits while a row of tab labels is
visibly clipped at the edge: the checker measured the one thing it knows how to
measure.

**Generalises to:** PDFs, exported images, charts, store screenshots. If a human
will look at it, a human must look at it once before you call it done.

---

## Shape 12 — Fixing the symptom and shipping a worse defect

**What happened.** A row of labels wrapped onto two lines on a small phone.
Forcing them onto one line stopped the wrapping — and removed the ability to
shrink, so the content ran 40px past the screen edge and the screen scrolled
sideways. Horizontal scroll is explicitly forbidden; wrapping is merely ugly. The
fix was worse than the fault.

It then took two further attempts: fixing the smallest phone broke the largest,
because the full row never fitted at either.

**The rule.** When a fix removes a constraint, ask what that constraint was
absorbing. Wrapping was absorbing overflow. And **verify a responsive fix across a
range of devices, not on the one you were shown** — the final version was checked
across the supported range, from the smallest phone to the largest tablet and
inside the safe-area insets, which is what proved it.

**Cheap technique:** checking each supported device size for content past the
screen edge costs seconds and ends the guessing.

---

## Shape 13 — The admin that manages the wrong half

**What happened.** The backend blueprint warns, in as many words, about an
owner surface that manages *transactions* but not *content*. Having read and
quoted that warning, the build produced its exact inverse: every piece of content
was editable, and the owner could not add a lesson time, close one when the
weather turned, mark a booking complete, or replace a photograph.

Worse, availability was generated only at process start, so the bookable diary
would have silently emptied after six weeks with nobody told.

**Why it happens.** A named failure mode gets defended against literally. Reading
"transactions but not content" as a rule about *content* leaves the mirror image
completely unguarded.

**The rule.** Treat a documented failure as an *example of a shape*, not a
checklist entry. Then run the actual coverage test from `07-HANDOVER-GATE.md` §B:
for every category in the app **and every operation the business runs
on**, ask whether the owner can do it without you.

---

## Shape 14 — A standing instruction decays over a long session

**What happened.** The owner asked, explicitly and early, that every decision be
put to them as a choice with a recommendation. It held for several rounds. Twenty
turns later, under momentum on an interesting problem, six design decisions were
taken unilaterally and simply built. The owner had to say twice that the
instruction had been dropped.

**Why it happens.** An instruction given once lives in the earliest part of the
conversation, which is the first thing to be summarised away. Momentum on a
problem feels like progress, and stopping to ask feels like friction.

**The rule.** A standing instruction about *how to work* belongs somewhere it is
re-read, not somewhere it was read once — the project's `CLAUDE.md`, which is
re-injected after every compaction. And the moment you notice you are about to
choose between real alternatives, that is the moment the instruction applies,
however inconvenient the timing.

---

Every one is a variant of the same failure: **acting on a belief that felt
verified but was not.** A stale document read as current. A symptom attributed to
the wrong cause. A surface mistaken for a record. A subproblem mistaken for the
problem.

The defence is not more caution. It is cheaper evidence:

- Query the machine instead of reading about it
- Render the comparison instead of imagining it
- Sweep the range instead of spot-checking it
- Read the row instead of the page
- Measure from both ends instead of one

Each of those costs a minute. Each of the mistakes above cost considerably more.
