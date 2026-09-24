---
started_at: 2026-09-24T05:45:00Z
trigger: Founder, 2026-09-24 — "there has to be more of this bugs in the system", having chosen "render every Sales Coach screen and look". The first two screens rendered produced three controls that are invisible in light mode.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a dark-mode idiom, in a module that just got a light mode

## How this became reachable this morning

`ThemeToggle` reached the Sales Coach header a few hours ago. Before that, `SalesCoachShell`
rendered its own nav and never mounted the ELOSTATE Sidebar, so **nobody working inside Sales
Coach had a way to be in light mode at all.**

Every light-mode defect in that module has therefore been latent since it was written, and
unreachable, and is now reachable. Shipping the toggle did not create these; it made them visible,
which is a different and better thing than leaving them hidden.

## The class

`white/N` — white at a fractional opacity — used as a neutral tone.

On the matte-black field it is a soft grey: a border, a card fill, a switch track. On cream it is
**nothing**. It is not a theme-neutral colour; it is a dark-mode idiom that happens to have worked
because there was only one mode.

## The three found by looking, in order

1. **`MobileHomePager.tsx:83`** — the inactive pager dot, `bg-white/20`. In light mode the strip
   shows ONE dot, so a rep cannot see a second page exists. On the screen whose other page held
   the only way out of Macro Mode, which is the bug fixed an hour earlier.
2. **`MacroModeToggle.tsx`** — the off-state track, `bg-white/15`. The switch renders as a bare
   white knob with no track: a control you cannot identify as a control, in a state you cannot
   read. **It is also a candidate explanation for the founder's own words**, "i can't see the
   button".
3. **`page.tsx`** — `border-white/10` and `bg-white/[0.02]` on the Macro Mode card and the two stat
   chips. In dark they are bordered cards; in light the page's structure dissolves into floating
   text.

Each was found by rendering the same surface in both themes and comparing. None is findable by
reading, because each is correct in the mode it was written in.

## Why the gate that exists did not catch it

`scripts/theme-audit.mjs` exists precisely for this and its header says it "Exits non-zero if any
theme-bound leaks remain". It passes.

It scans the navy/surface scale, brand hexes, pale tints and inline dark hexes. **`white/N` is in
none of its categories.** Its own FILE_ALLOWLIST mentions "white/10 chrome" — but only to excuse
whole files that are *deliberately* fixed-dark, which means the author knew `white/N` is a
dark-mode idiom and handled only the case where it is correct.

The concept lives in the author's head and not in the checker. Same shape as `writer:audit` this
morning: the gate answers a nearby question confidently and the real one is not in its vocabulary.

## What could go wrong with the fix

1. **Changing dark's appearance.** A token that fixes light must not make dark look different, or
   the fix is a redesign nobody asked for.
2. **Fixing the shell.** `bg-brand-shell` is fixed dark BY DESIGN — its `text-white/90` is correct
   and "fixing" it would be the opposite mistake.
3. **Adding a failing gate with 256 violations.** Then allowlisting 47 files to go green, which is
   decoration. A30's standard is a check that fails without the author's cooperation, not one the
   author neutralises to ship.
4. **Claiming the whole class is fixed.** Three sites are confirmed by render. The rest are not.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The understanding that changes the work is WHY these are all latent: the module had no light mode until this morning. That reframes them from 'old bugs nobody noticed' to 'a class that just became reachable', which is also what makes the count worth measuring." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Verified present; theme-audit.mjs and tailwind.config.ts both opened before any token was chosen, rather than guessing which utilities exist." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Layer 4 is the surface; layer 2 asks whether it works when a real user invokes it.",
    "how_this_build_will_embody_it": "An invisible switch is not a layer-4 blemish. A control a person cannot see or read the state of has not delivered its result — it is layer 2 wearing layer 4's clothes." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm; audit adjacent surfaces.",
    "how_this_build_will_embody_it": "The dot vanishing produced the hypothesis 'white/N is a dark-only idiom'. The search confirmed it on two more controls and then MEASURED the class at 256 sites rather than asserting it is everywhere." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-225", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "A user-specified experience is layer-2, not deferrable polish.",
    "how_this_build_will_embody_it": "The founder asked for light/dark on this page. A light mode where the switches are invisible is not the thing they asked for, so this is finishing that request rather than a separate cosmetic pass." },

  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "240-262", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Diagnose before patching; trace interconnections before committing.",
    "how_this_build_will_embody_it": "Each token was chosen by reading globals.css for what the variable actually resolves to in BOTH modes, then re-rendering to confirm — including re-checking that dark did not change." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Everything is an event and events are append-only; entity state is derived by replaying them rather than edited in place, because retrospective analysis depends on the history staying intact.",
    "how_this_build_will_embody_it": "No migration and no writes. Class names only." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Distrust the confident fast answer; the builder under pressure is the biggest risk.",
    "how_this_build_will_embody_it": "The tempting move was a failing gate for the whole class, which looks rigorous and would have needed 47 allowlist entries to ship. Measuring first is what stopped that." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "The checklist; 5b asks whether I thought first and then searched.",
    "how_this_build_will_embody_it": "5b, and the search's output is a number rather than an adjective." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Methodology in the working tree; the label is not the content.",
    "how_this_build_will_embody_it": "theme-audit.mjs was READ, not assumed from its name — which is how its blind spot was found rather than trusted." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "560-566", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "A user's mental model must survive moving between modules; a break is a category of confusion, not an instance.",
    "how_this_build_will_embody_it": "Light and dark are two modules for this purpose. A rep who learns where the Macro switch is in dark finds a blank space in light." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "The hex values for every token used here were read from globals.css lines 74/110/76/112 this session, not recalled." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-698", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "One instance is a class; sweep to the boundary and record what the sweep found.",
    "how_this_build_will_embody_it": "The boundary is measured — 256 uses, 47 files — and explicitly NOT cleared. Three are fixed and the rest are named as unverified rather than implied clean." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-778", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "A lesson in prose returns unless a gate fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The gate is DECLINED here, with the reason: at 256 violations it would ship as 47 allowlist entries, which is a check the author routed around. Said plainly rather than dressed as done." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "Schema-complete is not built; a thing that exists and cannot be reached is not built.",
    "how_this_build_will_embody_it": "Fourth instance today of the same question. A switch rendered in a colour nobody can see is unreachable in the most literal way available." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-24T05:45:00Z",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "npm run check with its exit code, and six screenshots opened and described — before and after, in both themes, for each fix." }
]
```
