---
started_at: 2026-09-24T04:16:08Z
trigger: Rendering the Recordings panel in a real browser for the first time threw `TypeError: Cannot read properties of undefined (reading 'dot')`. I assumed my fixture was wrong. It was wrong AND the bug was real — `pitch_score_events.type` has allowed a third value since migration 0254 and this surface has no marker for it.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a cast at the database boundary blanked a manager's whole tab

## How it was found, because the how matters

Not by a test. Twenty-four builds of render tests asserted strings and every one of them passed.

It was found by compiling the real Tailwind bundle, rendering the component with the existing
fixtures into a file, and opening that file in the Chrome already installed on this machine. The
first render crashed. My first reaction was that my fixture used an illegal `kind`, which was true,
and I nearly stopped there — the comfortable conclusion, available in one second, that puts the
fault in the test rather than the product.

The fixture was wrong AND the product was wrong. Checking which took four greps.

## The chain, each link verified rather than assumed

1. `supabase/migrations/0254_pitch_score_verdicts.sql:37` —
   `check (type in ('bonus', 'violation', 'rejected_bonus'))`. **Three** values, since 0254.
   Its own comment: *"A third event kind. Not a bonus (it awarded nothing) and not a violation (it
   cost nothing)."*
2. `storePitchScore.ts:151` writes `type: "rejected_bonus"` for every audio-inferred bonus under
   the confidence floor. `0256_apply_pitch_score_override.sql:88` writes one every time a manager
   **removes** a bonus — *"Demoted, never deleted."* Both are routine, not exotic.
3. `readRecordings.ts:214` said `type: e.type as "bonus" | "violation"`.
4. `keyMoments.ts:106` forwarded it as `kind`; its `MomentKind` union named five values and not
   this one.
5. `RecordingsTab.tsx:489` and `:532` evaluated `MARKER[m.kind].dot` — `undefined.dot`, thrown
   during render.

**A thrown render is not a missing dot.** It is a manager opening Recordings and getting nothing:
no list, no player, no message they can act on.

## Why every automated check was green

`MARKER` is typed `Record<MomentKind, …>`. Indexing a `Record` by its own finite key union is
"always present" to TypeScript — `noUncheckedIndexedAccess` deliberately exempts it, and correctly,
because the type says the key set is closed. The type was closed. **The data was not.**

The cast is what made the two disagree, and a cast is an assertion the row cannot disprove. Four
other modules — `readPitchScore.ts:38`, `storePitchScore.ts:78`, `readPitchPeriod.ts:163`,
`PitchDetail.tsx:126` — all carry the correct three-value union. **One reader disagreed with four
writers and the compiler sided with the reader**, because the reader had asserted.

## Two things I nearly reported and did not

Both came out of the same render, both looked like defects, neither is live.

- `RecordingsTab.tsx:599` reads `l.speaker === "agent" ? "Rep" : "Customer"` — everything
  not-`agent` labelled Customer. Reachable? No: `keyMoments.ts:183` narrows the column to
  `agent | customer | unknown` at the read, and `:597` skips `unknown`. Dead branch, not a bug.
- `OUTCOME` at `RecordingsTab.tsx:56` names three values and falls back to printing the raw enum.
  Incomplete? No: `0252_pitch_score_system.sql:99` is
  `check (outcome in ('sold','follow_up','no_sale'))` — exactly those three.

Recording them because a 50% false-positive rate on visually-obvious findings is the thing to
distrust, not the thing to leave out (§5).

## What could go wrong with the fix, before I write it

1. **Widening the union without widening the map.** Adding `rejected_bonus` to `MomentKind` and
   forgetting `MARKER` moves the crash rather than removing it. TypeScript catches this one, because
   `Record<MomentKind, …>` requires exhaustiveness — which is the same property that hid the bug.
2. **Replacing one cast with another.** My first attempt wrote
   `e.type as MomentSource["events"][number]["type"]` — honest about the vocabulary, still an
   assertion. A cast cannot fail; that is the defect.
3. **The green zero.** `rejected_bonus` stores `points: 0`. The points span painted everything
   not-negative green, so "considered and declined" would render as a green `0` — the colour of a
   bonus, on the one moment that is not one.
4. **The rubric lookup.** `ev.type === "bonus" ? BONUSES : VIOLATIONS` sends a rejected bonus to the
   violations table, misses, and falls back to printing `bonus.inside` where a human should read
   English.
5. **A fourth value, one day.** Fixing three known values leaves the same shape for the next one.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-24T04:16:08Z",
    "why_it_governs": "Understanding precedes solving; distrust the answer that arrived fast.",
    "how_this_build_will_embody_it": "The fast answer was 'my fixture is wrong'. It was true and it was not the whole truth, and stopping there would have left a live crash in a partner's path." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-24T04:16:08Z",
    "why_it_governs": "The methodology must be in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "Checked, and it mattered: an audit specification arrived naming six authorities, five of which are NOT in this tree. Auditing against them would have meant quoting a kit from memory — CAT-001 exactly. Escalated instead of proceeding." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Layer 2 is 'does it work when a real user invokes it', not 'does the unit test pass'.",
    "how_this_build_will_embody_it": "Every unit test passed and the screen was blank. Layer 2 was only reachable by rendering it." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Two hypotheses formed from the render (speaker labels, outcome names) were searched and both DENIED. The one that survived is the one reported." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-320", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "One source of truth for a decision, consumed rather than re-derived.",
    "how_this_build_will_embody_it": "The database's CHECK is the authority on what values exist. Five modules held an opinion about it; the cast was a sixth opinion that could not be wrong out loud. The fix makes the narrowing single and the mirror gated." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Append-only; state is derived by replay, never edited away.",
    "how_this_build_will_embody_it": "No migration, no writes. And it is WHY the bug exists: 0256 demotes a removed bonus rather than deleting it, precisely so the judgement survives. The append-only discipline created the third value; the reader never learned about it." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident fast answer.",
    "how_this_build_will_embody_it": "Two of three visually-obvious 'findings' were false. Reported as such rather than quietly dropped." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-24T04:16:09Z",
    "why_it_governs": "The checklist; item 0 sends every founder decision to a picker.",
    "how_this_build_will_embody_it": "The meaning of a rejected bonus on this strip is a product decision, not mine. Asked, answered 'its own grey marker, Considered', built as chosen." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "The methodology governing a build must live in the agent's working tree — having the label is not having the content.",
    "how_this_build_will_embody_it": "Tested for real mid-build. An audit specification arrived naming 01-CONSTITUTION.md, 03-ANTI-FAULT.md, FLAWFIXV1.MD, 00-START-HERE.md, 06-VERIFICATION.md and `node tools/gate.mjs`. I checked: NONE of them is in this tree. I know what those documents say from the kit they belong to, and that knowledge is exactly what A19 says not to act on. Escalated and offered the substitution rather than quoting them." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "Citations without session-reading operate undetected — a fluent quote is indistinguishable from an opened file.",
    "how_this_build_will_embody_it": "Every clause cited here was opened this session at its line range, bracketed by the timestamps above. The migration lines (0252:99, 0254:37, 0256:88, 0215:20) were read from the files, not recalled, and two of them contradicted what I was about to report." },

  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-698", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "A reported bug is one instance of a class; sweep to the boundary.",
    "how_this_build_will_embody_it": "The class is 'a cast that narrows a database column to fewer values than its CHECK allows'. Swept, and the sweep is recorded in check.md — not assumed clean." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-778", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "A lesson in prose returns; it is not fixed until a gate fails without the author's cooperation.",
    "how_this_build_will_embody_it": "`// enum-source: pitch_score_events.type` binds the union to the CHECK through the existing enum:audit. It caught my FIRST attempt at declaring it — the marker was on a derived type it cannot parse — which is the property working on its author." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-806", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "The seam between the database and the surface is where a correct system becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "This is that seam, in its rendering form rather than its writing form: schema right, writer right, page right, and the screen blank." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-24T04:16:10Z",
    "why_it_governs": "'Verified' names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code, two mutants restored after being caught, and a screenshot of the fixed surface that was OPENED and described rather than assumed." }
]
```
