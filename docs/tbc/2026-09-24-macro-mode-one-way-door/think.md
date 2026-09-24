---
started_at: 2026-09-24T05:20:00Z
trigger: Founder, 2026-09-24 — "macro mode button of the website is broken", then, asked which of three symptoms it was — "it dissapeared and now i can't see the button and the normal mode never was triggered and the system reamins in MACRO mode."
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a one-way door, built by two correct decisions

## The report, and why the first three guesses were all wrong

I offered three symptoms in a picker — flips-then-reverts, unresponsive, or saved-but-the-UI-does-not-follow
— and the founder's answer was a fourth I had not imagined: **the button vanished and they are
stuck in Macro Mode.**

Worth recording, because the three I offered came from reading the code for defects, and the real
one came from a person trying to use it. A control that cannot be reached is invisible to every
kind of inspection that asks "is this correct?".

## The mechanism, each step read from the file

1. `page.tsx:201` — `macroOn === true` swaps the mobile home for `MobileHomePager`.
2. `page.tsx:235` — the only `MacroModeToggle` in that branch sits on **page 1** of the pager;
   page 0 is `DoorScreen`.
3. `MobileHomePager.tsx:17` — `useState(0)`, and its own comment: *"open on page 0 on every mount"*,
   *"the index is NOT persisted (reset on cold load / first open …)"* — a recorded founder decision
   (INSPECTION.md, Q6/Q8).

So: turning Macro Mode on moves the only switch that turns it off onto a page the rep has to know
to swipe to, and every subsequent launch puts them back on page 0. Not a glitch — **the composition
of three individually-correct facts.**

**Desktop is fine.** `page.tsx:588` renders the toggle unconditionally inside the `hidden md:flex`
tree. Checked, because "the button disappeared" would have been equally consistent with a desktop
regression, and the component's own doc mentions one from 2026-08-19 — *"removing this left desktop
Macro reps with no way to reach the surfaces"*. That one has not returned.

## Why this is a layer-3 failure, precisely

AMD-006 §1.5.1 layer 3 asks whether the completed feature leaves the user in a flowing state or
stalls them — *"empty state, dead end, unnecessary intermediate steps"*. Every part here passes on
its own: the toggle works, the pager works, opening on page 0 is deliberate and right. What fails
is the seam between them, and layer 3 is the only layer that looks at seams.

It is also the §1.5.1 sieve working as described: a broken layer 3 is not survivable by polish.
The surface is handsome and the rep is trapped.

## What I nearly did instead

I had already found and fixed a real defect in the same feature — `macro-mode/route.ts` POSTed
`.update()` and checked only `error`, so a write matching zero rows reported success. That is a
genuine false-ok write and it stays fixed. **It is not what the founder hit.** Shipping it and
calling the report closed would have been the comfortable answer that leaves a rep stuck.

## What could go wrong with the fix

1. **Putting the escape inside the pager.** It would land on one page or the other and the trap
   would move rather than close.
2. **Horizontal overflow at phone width.** "Back to ELOSTATE" and a second control on one 390px
   row is not obviously safe.
3. **Duplicating the setting.** Two Macro Mode controls on one screen is the confusion this
   session already avoided with the theme toggle.
4. **A test that pins the button rather than the property.** A future redesign may move the escape;
   it must not put it back behind the swipe.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Understanding precedes solving; the identification must be earned, not assumed because an answer arrived quickly.",
    "how_this_build_will_embody_it": "I had a fixed defect in hand and it was the WRONG defect. The founder's own words were the diagnosis; the code review was not." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Methodology in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "Verified present; AMD-006 opened at its own file for the layer-3 wording rather than quoted from memory." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Four layers; layer 3 is whether the feature composes with what surrounds it, and the order is a sieve.",
    "how_this_build_will_embody_it": "Layers 1, 2 and 4 all pass here. Only layer 3 fails, and it is the one that traps a person." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "THINK about what could fail, then search to confirm; a bug rarely lives alone.",
    "how_this_build_will_embody_it": "The search around it found the false-ok write and five more instances of that class on `profiles`. Fixed, and explicitly NOT reported as the answer to this report." },

  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "240-262", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Diagnose before patching; no error loops; trace interconnections.",
    "how_this_build_will_embody_it": "The first fix was real and was not this. Rather than shipping it as the answer, the symptom was taken back to the code until the mechanism explained the exact words used." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Everything is an event and events are append-only; entity state is derived by replay rather than edited in place, because retrospective analysis depends on the history staying intact.",
    "how_this_build_will_embody_it": "No migration, no schema change. The Macro Mode flag is a per-rep preference the rep already owns." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Distrust the confident fast answer; treat objections as data.",
    "how_this_build_will_embody_it": "Three confident hypotheses, all wrong. The founder's correction WAS the data, and it pointed somewhere none of them did." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "The checklist; 5a asks whether the completed feature leaves the user flowing or stalled.",
    "how_this_build_will_embody_it": "5a is the entire finding. It is the question that was not asked when the pager shipped." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Methodology in the tree; the label is not the content.",
    "how_this_build_will_embody_it": "MobileHomePager was opened and its page-0 decision read at the line, rather than inferred from the component's name." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "560-566", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "If a user learns feature X in module A, does their mental model work in module B? If not it is a category of confusion, not an instance.",
    "how_this_build_will_embody_it": "Desktop and mobile ARE two modules for this purpose: the same toggle is always-visible on one and swipe-hidden on the other, so a rep who knows where it lives on a laptop cannot find it on a phone." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Every line number here was opened this session; the MobileHomePager and MacroModeToggle comments are quoted from the files." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-698", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "A reported bug is one instance of a class; sweep to the boundary.",
    "how_this_build_will_embody_it": "TWO classes came out of one report — the false-ok write (5 instances on `profiles`, all fixed) and the mode you cannot leave. The second is swept in check.md and is NOT clean." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-778", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "A lesson in prose returns; gate it or it comes back.",
    "how_this_build_will_embody_it": "The render test asserts the escape exists AND sits outside the pager — the property, not the button — so a redesign that moves it is free and one that hides it again is not." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "Built is not reachable; a settings page with no nav entry is unreachable and therefore nonexistent.",
    "how_this_build_will_embody_it": "Third time today, and the sharpest: the control existed, rendered, worked, and was unreachable. A31's own first example is a settings page with no nav entry." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-24T05:20:00Z",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "npm run check with its exit code, a mutant that fails the new test by name, and a render at 390px opened and described — including the first capture whose overflow turned out to be my own harness." }
]
```
