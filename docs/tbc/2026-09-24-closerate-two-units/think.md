---
started_at: 2026-09-24T06:53:43Z
trigger: Rendering the rep-detail path showed "0.129%" in the Reps table beside a team card reading "13%". It looked like a number wrong by 100x on a screen investors would see. It was my fixture — and the reason I believed it is real.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the phantom, and the trap that made it believable

## What I nearly did

The founder is presenting to investors today. I rendered the Coach Assessment rep-detail path —
the path I had just recommended for that demo — and the Reps table showed a close rate of
**`0.129%`** while the team card above it read **13%**.

Two sibling call sites use a `pct()` helper that multiplies by 100. The table bypasses it. That is
a complete, coherent story for a 100x error on a manager's screen, and I was one message from
telling a founder his demo had one.

**It was my fixture.** `readTeamAssessment.ts:196` already converts —
`Math.round(kpis.closeRate * 1000) / 10` — so `RepRow.closeRate` reaches the wire as `12.9` and
rendering it raw with a `%` is correct. I passed the ratio.

Third fixture-induced phantom of the day. The first two cost minutes. This one would have cost
credibility at the worst possible moment.

## What is actually true

One response object carries `closeRate` in two units:

| Field | Unit | Rendered by |
|---|---|---|
| `wire.reps[i].closeRate` | percentage, 12.9 | raw, with `%` appended |
| `wire.team.kpis.closeRate` | ratio, 0.129 | `pct()`, which multiplies by 100 |
| `wire.detail[id].kpis.closeRate` | ratio, 0.129 | `pct()` |

Every consumer matches today. Nothing structural stops the next one picking the wrong renderer,
and that failure is silent and wrong by 100x.

This is A21's shape — one name, two meanings, and a reader's mental model breaking at the
boundary — except both meanings live on a single payload rather than in two modules.

## Why the obvious fix is the wrong fix TODAY

Renaming `RepRow.closeRate` to `closeRatePct` removes the trap permanently. It is 19 references
and the compiler finds every one.

**It changes a WIRE KEY.** The server would send `closeRatePct`; a browser holding the previous
bundle reads `closeRate`, gets `undefined`, and renders `undefined%`. I have been careful about
exactly this shape all session — "a browser holding a bundle from before this field will not
receive it" is written into three components I touched today.

The afternoon before an investor demo is precisely when not to accept a deploy-window risk in
exchange for closing a latent problem. §5 names this: the temptation is to make the system *less*
safe for a faster-looking result, and the pressure is the tell.

## What could go wrong with what I AM doing

1. **A comment is not a gate.** A30 is explicit that a lesson in prose returns. If the only output
   is two doc-comments, this recurs.
2. **A drift-guard that passes vacuously.** The hazard I have hit four times today: a test green
   about nothing.
3. **Recording it and forgetting the rename.** The follow-up has to be findable, not buried.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Understanding precedes solving; a fast, fluent, well-sourced answer imitates understanding convincingly.",
    "how_this_build_will_embody_it": "The fast answer had a helper, two correct call sites and one that bypassed it — a complete story. Reading readTeamAssessment.ts:196 took thirty seconds and destroyed it." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Verified. The same check earlier today caught an audit spec naming five documents this repo does not contain." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Layer 2 asks whether the feature delivers the intended result when a real user invokes it.",
    "how_this_build_will_embody_it": "Nothing on screen is wrong. This is not a layer-2 defect; it is a trap for the next change, and saying so plainly is the difference between a finding and an alarm." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-24T06:54:30Z",
    "why_it_governs": "THINK first about what could be wrong, then SEARCH to confirm; quality over quantity, and the bar for surfacing is evidence, not pattern-matching.",
    "how_this_build_will_embody_it": "This build is the clause's failure mode caught in the act. I had a finding with a screenshot behind it and the bar it did not clear was 'evidence' — a picture of a number is evidence about the renderer. The search that should have come BEFORE surfacing it was reading the producer." },

  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "240-262", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Diagnose before patching; no error loops; interrogate locked doors.",
    "how_this_build_will_embody_it": "The rename is the real fix and it is deferred for a stated reason, not abandoned. That is finding a better destination rather than picking the lock on a deploy window." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "One authority computes a decision; consumers must not re-derive it from the same raw inputs.",
    "how_this_build_will_embody_it": "The decision here is UNITS. It is made once, in readTeamAssessment, and then re-derived at every render site by whoever remembers which field is which. The guard is the interim substitute for making it unambiguous." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Everything is an event and events are append-only; entity state is derived by replaying them rather than edited in place, because retrospective analysis depends on the history staying intact.",
    "how_this_build_will_embody_it": "No migration, no writes. Two comments and a test." },

  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "379-389", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Hard metrics must be objective and defensible; measuring the wrong thing is grading your own homework.",
    "how_this_build_will_embody_it": "Close rate IS one of the hard metrics. A units collision on it is a defensibility problem, not a formatting one — the number a manager argues about must mean one thing." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "The biggest risk is the builder under pressure; distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "Both halves fired today. The confident fast answer was the phantom. The pressure is an investor demo, and the shortcut on offer was a wire rename that looks decisive and risks undefined% in the room." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "The checklist; item 3 asks whether I am about to repeat a failed approach.",
    "how_this_build_will_embody_it": "Item 3, answered on my own tests: four vacuous-green tests today, so the guard was checked by reverting the conversion and watching it fail by name." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Having the label is not having the content.",
    "how_this_build_will_embody_it": "`closeRate` is a label that means two things. The content is at readTeamAssessment.ts:196 and aggregate.ts:299, and only reading both tells you which." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "560-566", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "One name, two meanings, is a category of confusion rather than an instance.",
    "how_this_build_will_embody_it": "The exact clause. It cost me an hour and nearly cost a false report; the next person pays the same toll unless the name changes." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Every line cited — 196, 177, 226, 299, 110, 347, 543, 628 — was opened this session." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-698", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "A pattern match is a SUSPECT, not a defect; verify adversarially.",
    "how_this_build_will_embody_it": "The suspect was a rendered screenshot, which felt like proof. Verifying it adversarially meant reading the producer, not the renderer." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-778", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "A lesson in prose returns; gate it or it comes back.",
    "how_this_build_will_embody_it": "Two comments would have been prose. The drift-guard test is the gate, and it was proven by reverting the conversion." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-24T06:53:43Z",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "npm run check with its exit code — and the first run of it returned CHECK_EXIT=2, because the test I had just written passed under vitest and did not typecheck." }
]
```
