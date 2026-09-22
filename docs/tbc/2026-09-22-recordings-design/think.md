---
started_at: 2026-09-22T18:24:18+08:00
trigger: The founder asked "did you build this?" of the Recordings panel and I found five places where the build differs from the design they supplied. §1.5.4 says a user-specified experience is layer-2, not deferrable polish.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the design was the specification, and five parts of it were not built

## Why this is not polish

§1.5.4 is explicit, and it exists because of an incident with exactly this shape — a schedule export
that shipped correct and monochrome after the founder had asked for colour, filed under
layer-4-optional, and reported done:

> **The layer at which a property is binding is set by whether the user made it part of the
> intended result — not by the property's category.**

The founder supplied `Coach Assessment  Recordings tab open (web).pdf` as the specification for this
screen. Its wording and arrangement ARE the intended result. Five parts of it are absent, and
Project 4 was reported complete.

## The five, read from the JSX rather than grepped

A grep for a display string produces false negatives — JSX escapes (`&apos;`) and CSS (`uppercase`)
both change the literal. That caught me twice while checking this: `KEY MOMENTS` and
`TRANSCRIPT AT 7:22` ARE built, as `Key moments` and `Transcript at {clock}` with an `uppercase`
class, and the dashboard's `THIS WEEK'S FOCUS` column is built as `This week&apos;s focus`.

| The design | The code |
|---|---|
| tabs **Overview** · **Recordings (7)** | `Assessment` · `Recordings`, no count |
| **RECENT RECORDINGS** · **7 all time** above the list | nothing — the `<ol>` starts straight in |
| **Open pitches** / **Open full coaching notes** | absent |
| **58.5 base +5.0 −2.0 = 61.5**, the total large and amber | `78.5 · Solid · base 62.0 · bonus 20.0 · violations −3.5` |
| **KEY MOMENTS · CLICK TO JUMP** | `Key moments` — the affordance half missing |

## One of them is a wire change, not markup

**"7 all time" cannot be `rows.length`.** The list read is bounded at 100 and the surface already
says so — *"Showing the most recent 100. Older recordings are on the record and not on this list."*
So `rows.length` is 100 for any rep with more, and "100 all time" would be exactly the false claim
three of today's builds removed.

The total has to come from the database, as `count: "exact"` on the existing query — the same shape
as `reviewFlagsTotal` (0264) and the bell's `total`, both landed today. Third time, same pattern,
which is itself worth noticing.

## And one is the build being right

Not in the table above, deliberately. The design's rep subtitle reads **"Rank #5 this week"**; the
build reads **"#5 this period"**. The page has a Day/Week/Month/All-time toggle — visible in the
design's own header, set to Week in the capture. The mock says "this week" because that is the
state it was drawn in; hard-coding it would make the subtitle lie on three of the four settings.

Taking the "Rank" prefix and leaving the period word is the whole of that change. A
design-conformance pass that copies a snapshot's wording into a surface with a control the snapshot
does not show is how conformance makes a product worse.

## What cannot be built as drawn

The detail heading's second line is **`Maple Ct · Sold`**. The outcome is in the wire and simply is
not rendered. **A street is not in the schema at all** — `door_knocks` (0215) is
`id, company_id, rep_id, outcome, knocked_at, local_date, client_knock_id, created_at`, and no
later migration adds one. That line needs an address the product has never asked a rep for, so the
honest version today is the outcome alone, and the address is a separate question for the founder.

## What could go wrong, before I look

1. **The wire boundary, a fifth time today.** `total` is a new field on an existing response.
2. **The tab count needing a second fetch.** The label must show `Recordings (7)` while the
   Assessment tab is open, so the count is needed before the Recordings tab has ever loaded.
3. **"Showing the most recent 100" becoming wrong.** Once `total` exists, that line should say what
   it is showing OF, and leaving both would be two sentences about one bound.
4. **Re-deriving the cap.** The page size lives in `readRecordings.ts`; the surface must report the
   bound from the data rather than by knowing the number (§2.2).
5. **Conformance for its own sake.** Two of the five (the buttons) have no destination in the
   design or the product. Wiring them to a guess would be worse than leaving them out.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The understanding that changes the work is that one of the five is a wire change and one of the apparent six is the build being RIGHT. Both came from reading the JSX and the schema rather than the screenshot." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "All fifteen opened at their line ranges in the command immediately before this file, and the design PDF was rendered and read rather than described from the founder's screenshot of it." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "Four layers; the order is a sieve and layer 4 cannot rescue a broken layer below it.",
    "how_this_build_will_embody_it": "Read together with §1.5.4 this is the whole justification: these look like layer-4 items and are layer-2 ones, because the founder made them part of the intended result." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "THINK first, then search.",
    "how_this_build_will_embody_it": "The grep-versus-render trap was hit twice before this document was written, which is why the table above is sourced from the JSX." },

  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-196", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "A dependency outside the repository is not complete until verified or documented and surfaced.",
    "how_this_build_will_embody_it": "The `Maple Ct` line depends on data the product never captures. Not external config, but the same discharge: documented and surfaced as a precondition rather than quietly dropped from the design." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-225", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "A user-specified experience is layer-2 and is never waivable by the follow-up-polish clause; reporting complete with it unmet is the under-deliver mirror of overtaking.",
    "how_this_build_will_embody_it": "This is the clause the build exists under. Project 4 was reported done with five specified parts absent, which is precisely the failure §1.5.4 was ratified to prevent — and the incident behind it, a monochrome export shipped after colour was asked for, is the same mistake." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "Consume the verdict; do not re-derive it.",
    "how_this_build_will_embody_it": "The surface reports the bound from `total` rather than by knowing the page size. A second copy of `100` in the component would drift from `LIST_LIMIT` the first time it moved." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "Events are append-only and entity state is derived by replaying them rather than edited in place; the full history must stay intact because retrospective analysis depends on it.",
    "how_this_build_will_embody_it": "No migration and no writes. A count and some markup." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "Distrust the confident answer.",
    "how_this_build_will_embody_it": "The confident answer was a six-row gap table built from greps. Two rows were false and one was the build being right — a 50% error rate on a list I had already given the founder." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T18:24:18+08:00",
    "why_it_governs": "The checklist; 5d asks whether the founder specified the experience as part of the ask.",
    "how_this_build_will_embody_it": "5d, answered yes, which is what makes this work rather than a preference." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T18:24:19+08:00",
    "why_it_governs": "Having the label without the content — describing an asset instead of opening it.",
    "how_this_build_will_embody_it": "The design was opened at full page and read; the founder's screenshot of its bottom quarter was described separately and is not the source for any claim here." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T18:24:19+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Opened in one command, timestamped either side." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-696", "read_at": "2026-09-22T18:24:19+08:00",
    "why_it_governs": "One instance of a class; sweep to the boundary.",
    "how_this_build_will_embody_it": "The boundary is the rest of that design page — six other PDFs sit unopened in the same folder, and whether THEY match what was built is unknown. Named in the residual rather than implied." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T18:24:19+08:00",
    "why_it_governs": "Gate the class or it returns.",
    "how_this_build_will_embody_it": "The honest limit: nothing can gate 'the build matches the design'. A render test asserts the strings THIS build put there, which is a tautology one step removed. Said in the remediate rather than dressed up." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T18:24:19+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code, render tests for each changed string, and an explicit statement that none of it verifies the result LOOKS like the design — only a person with the PDF beside the screen can say that." }
]
```
