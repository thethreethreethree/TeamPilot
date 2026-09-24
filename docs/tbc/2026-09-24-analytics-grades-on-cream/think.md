---
started_at: 2026-09-24T07:31:55Z
trigger: Rendering Pitch Analytics in both themes showed skill cards with no borders on cream, and a grade-colour scale whose middle band is contrast-aware while the bands either side of it are pale dark-mode tints. Also a fifth fixture phantom — one out-of-range number producing three symptoms.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the right pattern was in the same expression

## The grade scale, read in full

`analytics/page.tsx:576-583`:

```
s.score >= 8  → text-emerald-300
s.score >= 5  → text-brand
s.score <  5  → text-amber-300
```

`text-brand` resolves through `--brand-text`: ember.400 on dark, ember.700 on light. It is the
contrast-aware token, and `globals.css:120` records why it exists — the founder reported the
previous value as "too light, hard to see" on 2026-07-24.

The two bands either side of it are raw `-300` tints, which are dark-mode tones. On cream
`emerald-300` and `amber-300` sit near 1.5:1.

**So a rep's BEST skill and their WEAKEST are the two least readable things on the screen, and the
mediocre one renders perfectly.** The weakest is the entire point of the page — it is what the
"one score per skill, so you know exactly what to work on next" copy promises to show them.

The right pattern was not elsewhere in the codebase. It was in the same ternary, one branch away.

## The card borders, same class as this morning

`border-white/[0.07] bg-white/[0.02]`, four instances. White at 7% and 2% are a soft edge on matte
black and nothing on cream — the class fixed on the Sales Coach home hours ago, found again here.

Dark rendered bordered cards; light rendered floating rows. Neither capture alone shows it.

## The fifth phantom, and why it was the most convincing

My fixture used scores of 72 / 58 / 44. The page rendered **"A+ 72/10"** on every row, under a
header reading "Across your last **0** scored calls" while each card said "14 of 18".

Three symptoms that look independent: a wrong denominator, a grade function stuck at A+, and two
counts disagreeing. All from one out-of-range number — the scale is 0-10, stated in plain words at
`RepSkillGrades.tsx:21`, and the header reads `sampleSessions`, which I never supplied.

Five phantoms today. This one is the most convincing because its symptoms multiplied: a single bad
input produced three separate-looking defects, and a plausible story for each. The check cost one
grep.

## What could go wrong with the fix

1. **Changing dark.** Both `-300` values must be preserved under `dark:`.
2. **Picking a light value that fails anyway.** `emerald-600` and `amber-600` need to actually
   clear AA on cream, not merely be darker.
3. **Touching `text-brand`.** The middle band is already right; "consistency" would make it worse.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Understanding precedes solving; distrust the confident answer.",
    "how_this_build_will_embody_it": "Three symptoms, one cause, and the cause was mine. Reading the scale before reporting is the whole of it." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "Verified; the 0-10 scale and the --brand-text rationale were read from their files rather than recalled." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Layer 2 is whether the feature delivers its intended result.",
    "how_this_build_will_embody_it": "This page promises to tell a rep what to work on next. Rendering that one number least readably is a layer-2 failure wearing layer-4 clothes." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-24T07:31:56Z",
    "why_it_governs": "THINK first, then search; quality over quantity, and the bar for surfacing is evidence.",
    "how_this_build_will_embody_it": "Three apparent findings, one checked away. The two that survived are in the commit; the third is in the fixture comment." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-225", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "A user-specified experience is layer-2, not waivable polish.",
    "how_this_build_will_embody_it": "Light mode was asked for this morning. A light mode where the number you are told to act on is the hardest to read is not it." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Everything is an event and events are append-only; entity state is derived by replaying them rather than edited in place, because retrospective analysis depends on the history staying intact.",
    "how_this_build_will_embody_it": "No migration and no writes. Class names and a capture." },

  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "379-389", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Measurement must be anchored to consequence, and be defensible.",
    "how_this_build_will_embody_it": "A skill grade is a claim about a person shown back to them. A claim they cannot read is not defensible, and this page's own copy says it is the same read their manager sees." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "Fifth phantom, and the one whose symptoms multiplied — three plausible defects from one bad input." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "The checklist; 5b asks whether I thought first and then searched.",
    "how_this_build_will_embody_it": "5b, on my own finding before it became a report." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Having the label is not having the content.",
    "how_this_build_will_embody_it": "\"A+ 72/10\" is what a label looks like when the content behind it was never checked." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "The ternary at 576-583 and the scale at RepSkillGrades.tsx:21 were both opened this session." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-698", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "One instance of a class; sweep to the boundary.",
    "how_this_build_will_embody_it": "The card borders are the same class fixed on the home screen this morning, found again on a screen nobody had rendered. The class is not closed — it is being found one surface at a time." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-778", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "A lesson in prose returns unless a gate fails without the author's cooperation.",
    "how_this_build_will_embody_it": "theme-audit's paleText category stops at -200 and every value here is -300. Deferred again, with the same reason recorded: widening it flags correct code on fixed-dark surfaces until those are rendered." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-24T07:31:55Z",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "npm run check with its exit code, and four captures opened — before and after, in both themes." }
]
```
