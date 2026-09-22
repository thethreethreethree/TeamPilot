---
started_at: 2026-09-22T13:40:00+08:00
trigger: Building the mobile Breakdown board, the section maxima it prints ("9.8 / 12") turned out to be unobtainable — no route serves the rubric, and the aggregate cannot supply it. The mobile plan asserted this data was already deployed.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the rubric has three consumers and no door

## Why (the record)

`src/lib/coach/pitchScore/rubric.ts` is deliberately data and not logic. Its own docblock says why:

> *"Three separate consumers read it: the scorer, the read-only 'Scoring rubric' screen the guide
> requires be 'rendered from rubric_config so it never goes stale', and Pattern Interrupt … If the
> rubric lived in the scorer, the other two would each grow their own copy and drift."*

All three consumers are in this repository, so all three `import` it. No route was ever needed and
none was written.

## The defect

There is now a fourth consumer — the mobile app — and it cannot import from this repository.

Two things on the rep dashboard need the rubric, and only one of them is the sheet:

1. **The Breakdown board prints each section as "9.8 / 12".** The 12 is `SECTIONS[].maxPoints`.
2. **The LOWEST badge is by PERCENTAGE of section max**, not absolute points. Team Transitions 4.7
   is lower in points than Close 8.6, and Close carries the badge because `8.6/15 = 57.3%` is below
   `4.7/8 = 58.8%`. Without the maxima the rule is not implementable at all.

## The trap, which is the reason this is a route and not a client-side sum

The obvious client-side move is to sum `maxPoints` across `elementStats` for each section.

`aggregatePitches` skips any element whose graded count is zero — it is **omitted** from
`elementStats` entirely. So a section containing an element the rep never reached reports a smaller
max, a higher percentage, and can hand the LOWEST badge to the wrong section.

It would be correct for every rep who had reached everything, which is the property that makes this
class invisible.

## What was wrong in the plan, stated rather than quietly fixed

`MOBILE-BUILD-PLAN.md` section 6 is headed **"Data — nothing new to build"** and lists *"Rubric for
the sheet — `rubric_config` via the score route"*. That is false in two ways:

- No pitch-score route returns the rubric. [OBSERVED — all seven read 2026-09-22]
- `rubric_config` is named in migration 0252 and in the guide, but **nothing in `src/` reads it**.
  The only mention is `rubric.ts`'s own comment quoting the guide's requirement as an aspiration.

The plan's own closing section exists to invite this check: *"Stated so it can be checked rather
than trusted."*

## The alternative, and why it was refused

Transcribing six sections, thirty elements, thirteen bonuses and five violations into the phone is
the duplication `rubric.ts` was written to prevent, and it degrades differently from an ordinary
copy: `pitches.rubric_version` pins the config a score was computed under, so a phone holding a
stale transcription would explain September's pitches with December's numbers and every value would
still look plausible.

## Not opened

- The Pitch Score implementation guide named on guide page 2. Not in the repository; never read. It
  does not block this, because this route adds no scoring behaviour — but it is the document that
  would say whether `rubric_config` was ever meant to be the runtime source.

## Session-read manifest (3.1.2 / A35)

Read in this session, from the working tree, before the route was written — not cited from cached
labels, which is the failure A22 exists for and the one A19's third question asks directly.

Four of these entries exist because the gate caught me citing clauses I had not opened. That is the
mechanism working as designed, and it is recorded here rather than quietly corrected.

```json
[
  { "id": "§0",
    "read_at": "2026-09-22T13:47:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "why_it_governs": "The first instinct was to sum maxPoints across elementStats client-side — a solution proposed before the problem was understood.",
    "how_this_build_will_embody_it": "The sum was traced to the zero-graded skip in aggregatePitches BEFORE anything was written, which is what showed it silently understates a section max. The route exists because the shortcut was diagnosed, not because it felt wrong." },

  { "id": "§0.1",
    "read_at": "2026-09-22T13:47:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "why_it_governs": "The methodology governing the thing being served — the Pitch Score implementation guide named on guide page 2 — is NOT in the working tree.",
    "how_this_build_will_embody_it": "Escalated rather than worked around: recorded in this file's Not-opened list and in the closure. It does not block this change because no scoring behaviour was added, and that limit is stated rather than assumed." },

  { "id": "§1.5.1",
    "read_at": "2026-09-22T13:48:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "why_it_governs": "Four layers in order. Layer 2 is the one at risk: a route returning 200 in a unit test is not a route a phone can reach.",
    "how_this_build_will_embody_it": "Layer 1 keeps the rubric one object with one reader. Layer 2 is honestly INCOMPLETE and recorded as residual R2 rather than reported working. Layer 3 composes with the six existing pitch-score routes and duplicates none. Layer 4 has no surface." },

  { "id": "§1.5.2",
    "read_at": "2026-09-22T13:48:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "why_it_governs": "THINK first, then search. The hypothesis was that the rubric was probably already served somewhere.",
    "how_this_build_will_embody_it": "The hypothesis was tested by grepping all seven routes and then OPENING each hit rather than trusting the match — which is how the breakdown route's docblock-only mention was excluded instead of counted as an endpoint." },

  { "id": "§1.5.4",
    "read_at": "2026-09-22T13:48:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "198-229",
    "why_it_governs": "It draws the line between agent-originated design (layer 4, deferrable) and user-specified experience (layer 2, never deferrable).",
    "how_this_build_will_embody_it": "Read and found NOT to apply: this route has no surface and the founder specified no experience for it. Recorded because checking a clause and finding it inapplicable is a different act from not checking it." },

  { "id": "§2.2",
    "read_at": "2026-09-22T13:52:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "307-324",
    "why_it_governs": "It is the clause rubric.ts cites in its own docblock, and the exact failure this route prevents: a consumer re-deriving a decision the authority already made.",
    "how_this_build_will_embody_it": "The mobile app consumes the rubric as a verdict rather than reconstructing section maxima from elementStats. The clause permits an unavoidable re-derivation only with a term-for-term mirror and a drift-guard test on both branches — the elementStats route offers neither, because an omitted element is invisible to the copy." },

  { "id": "§3.1.2",
    "read_at": "2026-09-22T13:53:00+08:00",
    "source_file": "docs/THINK_BUILD_CHECK.md",
    "line_range": "119-145",
    "why_it_governs": "It defines this manifest, and A35's point that the scope is what GOVERNS the work rather than what the agent intends to cite.",
    "how_this_build_will_embody_it": "The manifest was written before the gate was run, then corrected when the gate found four cited-but-unread clauses — precisely the dodge A35 describes, caught structurally rather than by good intentions." },

  { "id": "§6",
    "read_at": "2026-09-22T13:49:00+08:00",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "why_it_governs": "Checklist item 0 (AMD-013) and item 1a bind this change directly.",
    "how_this_build_will_embody_it": "Item 0: adding this route was a founder DECISION and went through an AskUserQuestion picker with the recommendation first and the hardcode alternative priced honestly, not prose asking permission. Item 1a: the methodology was read this session, which is this manifest." },

  { "id": "A19",
    "read_at": "2026-09-22T13:49:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-470",
    "why_it_governs": "This asset IS the shape of the bug, one level up: a governing document a consumer cannot reach produces citation without content.",
    "how_this_build_will_embody_it": "A19 says methodology must live where the builder meets it. The same argument applies to the rubric and the phone: a scoring methodology the app cannot read would be transcribed into it, and the copy would carry the labels without the content. This route is A19 applied to product data." },

  { "id": "A22",
    "read_at": "2026-09-22T13:50:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-606",
    "why_it_governs": "This manifest is worth writing only if it is true.",
    "how_this_build_will_embody_it": "Every clause listed was opened in this session before this block was finalised. The first draft cited four more from memory; the gate rejected it, they were read, and they are now entries with line ranges rather than removed to make the gate pass." },

  { "id": "A30",
    "read_at": "2026-09-22T13:50:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-780",
    "why_it_governs": "A lesson recorded only in prose returns. The elementStats trap is exactly such a lesson.",
    "how_this_build_will_embody_it": "It is encoded in a test rather than a comment: the suite pins that 8.6 over the Close max is below 4.7 over the Transitions max — the specific inversion the LOWEST rule turns on — so a client reconstructing maxima from elementStats cannot satisfy it on the case it gets wrong." },

  { "id": "A38",
    "read_at": "2026-09-22T13:51:00+08:00",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1011",
    "why_it_governs": "The temptation here was precise: eight passing tests and a clean tsc, reported as verified.",
    "how_this_build_will_embody_it": "The project's canonical gate, all of it, is run before the commit and its exit reported in the closure. A vitest run on one directory is not the gate and is not described as one." }
]
```
