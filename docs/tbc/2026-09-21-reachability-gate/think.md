---
started_at: 2026-09-21T15:40:00+08:00
trigger: Counting importers found an orphan an hour ago. If the technique works, it should be a gate rather than something somebody remembers to do.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — encoding the technique that kept working

## Why (the record)

Three modules in one feature, in one day, had no caller:

| | How it was found |
|---|---|
| `generatePitchScore` — the scoring engine | by hand, writing the route |
| `storePitchScore` — the writer | by hand, writing the route |
| `aggregatePitches` — 17 tests, four exports | **by counting importers** |

The third one is why this build exists. Every rubric average a rep would ever see was written,
tested and unreachable, and nothing in the codebase said so: the test count went up, all six
gates stayed green, and the module looked more finished than the ones that actually shipped.

A30 says a lesson kept in prose returns. A33 says a gate must be precise or not exist. Counting
importers is mechanical — there is no judgement in it — so it qualifies, and the only reason it
was not already a gate is that nobody had been bitten three times in a day before.

## What the sweep found beyond the pitch package

Six modules, and the interesting thing is that they split cleanly in two.

**Deliberate, and each says so in its own file:**

- `budgetVarianceAlignment.ts` — a pure TS mirror of migration 0191, kept as a regression lock on
  the SQL. Its docblock states it is not wired into a query path.
- `offlineQueue.ts` — the Door Log offline system, dormant by founder decision 2026-08-18, with
  the exact re-enable steps written in the file. Unreferenced is the *point*: it is never bundled
  and cannot interfere.
- `SalesCoachComing.tsx` — an honest placeholder for a nav item with no destination. Unused
  because every nav item currently HAS one, which is the good state.

**Debt, and nobody decided it:**

- `emit.ts` — Coach v4 instrumentation. Dead since commit `7904f180` on 2026-06-13, which deleted
  its only caller and said so in the message: *"emit.ts is now technically dead… Future cleanup
  will retire emit.ts + the v3 readout together."* Three months, no cleanup. **The consequence is
  live:** `/api/admin/coach-readout` and `/api/brain/learning-summary` still read
  `coach.suggestion_offered/accepted/dismissed`, and nothing has written one since June. Those
  surfaces report an accept rate that stopped moving, with nothing on them saying so.
- `EmptyState.tsx` — built for AMD-006 §1.5.1 layer 3, so a brand-new tenant does not land on a
  blank module. Adopted by nothing, so the problem it solves is unsolved everywhere.
- `fetchJson.ts` — the primitive built to close the error-dressed-as-no-data class at source.
  Adopted by nothing; the class is instead policed after the fact by INVARIANT 22.

The last three are the finding. Someone did the work and nothing reached it, which is exactly the
pattern that produced today's three.

## The allowlist is a record, not a silencer

Turning a red gate green by allowlisting is the §5 shortcut in its purest form — it helps the
builder and does nothing for the system.

So every entry begins with **DELIBERATE** or **DEBT**, and the DEBT entries carry the decision
that created them, the date, and what is currently wrong because of them. The list is then a
statement of what is owed rather than a place findings go to be silenced, and a *new* orphan
still fails the gate.

## Three bugs in the detector, and the third one caught itself

1. **A prose mention counted as a caller.** The first matcher used `body.includes(alias)`, and a
   comment in `observe.ts` reading *"same pattern as coach/emit.ts"* made `emit.ts` look reached.
   That is A19 at the detector level: the label of a dependency with none of the substance.
   Tightened to a quoted import.

2. **Referrers outside `src/` were invisible.** `tailwind.config.ts` imports the design tokens and
   `scripts/pilot-generate.mjs` imports the pilot code generator — both reported as orphans. A
   gate with avoidable false positives is one people learn to skip, so the scan now reads config
   files and `scripts/` as *referrers* without auditing them. `generateCode.ts` came off the
   allowlist as a result: a fact the scanner can see beats a standing exception.

3. **The audit found itself.** Once `scripts/` was scanned, the audit's own allowlist — which
   contains module paths as string literals — counted as a reference to every module in it.
   `budgetVarianceAlignment` went quiet and the planted-orphan self-test started *passing when it
   should have failed*. **The self-test caught it**, which is the entire reason it is there: a
   matcher that silently matches everything reports zero and means nothing, which is the
   confident-empty-result this codebase has an invariant against.

## Layers (§1.5.1)

1. **Structure** — one script, the shape of the existing invariant audit, with the same self-test
   discipline and the same allowlist-with-reasons convention.
2. **Effectivity** — proven by planting a module nothing imports and watching the gate fail, then
   removing it and watching it pass. Twice, before and after the matcher changes.
3. **Composition** — added to `npm run check` between `invariant:audit` and `tbc`, and to CI as
   its own step, so it runs where the other audits run rather than being a thing to remember.
4. **Surface** — none.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The problem is not 'aggregate.ts had no caller'. It is that three modules in one day had no caller and nothing in the system could say so — which is a detection gap, not three mistakes." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T12:30:00Z",
    "why_it_governs": "The methodology must be in the tree and read now.",
    "how_this_build_will_embody_it": "A31 and A33 were re-opened before the gate was written — A33 in particular, because it is the clause that would have FORBIDDEN this gate had importer-counting turned out to need judgement." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-63", "read_at": "2026-09-21T13:15:00Z",
    "why_it_governs": "Examine it as a detached observer with no stake in the existing assumptions.",
    "how_this_build_will_embody_it": "Every one of the six findings was investigated before being classified, including reading the June commit that orphaned emit.ts. Three turned out to be deliberate; assuming either way would have produced a wrong list." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-78", "read_at": "2026-09-21T12:05:00Z",
    "why_it_governs": "Holistic — trace what else a change affects.",
    "how_this_build_will_embody_it": "Adding a step to `npm run check` and to CI affects every future commit, so the gate was proven to fail correctly on a planted orphan BEFORE being wired in, not after." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "Layer 3 — does the completed feature leave the user able to continue?",
    "how_this_build_will_embody_it": "This gate detects layer-3 failures mechanically. An unreachable module is a feature that cannot be continued TO, which is what A31 means by the seam where a correct system becomes a nonexistent feature." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-165", "read_at": "2026-09-21T12:31:00Z",
    "why_it_governs": "THINK first, then search; the agent co-owns quality.",
    "how_this_build_will_embody_it": "Nobody asked for this. It came from noticing that the technique which found the last orphan was a thirty-line script, and that three occurrences is a class." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-280", "read_at": "2026-09-21T13:52:00Z",
    "why_it_governs": "Diagnose before patching; do not retry a failed identification with more force.",
    "how_this_build_will_embody_it": "When the self-test failed, the move was not to adjust the probe until it passed — it was to ask why a nonexistent file looked reached, which found the audit scanning its own allowlist." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-190", "read_at": "2026-09-21T13:55:00Z",
    "why_it_governs": "Silent dependence is the defect; prefer failing loud over failing quietly.",
    "how_this_build_will_embody_it": "An unreachable module is a silent dependence inverted — nothing depends on it, and nothing says so. The gate makes that fail loudly at check time instead of being noticed by whoever next needs the feature." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T13:25:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2; agent-originated design is layer 4.",
    "how_this_build_will_embody_it": "Carried from earlier today. Nothing here is user-facing, so the clause does not bind — cited because the commit range names it, and saying so is cheaper than implying a relevance it does not have." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Consume the verdict; do not re-derive it. Duplicated conditions drift invisibly.",
    "how_this_build_will_embody_it": "Bears directly: a module nothing imports is the OTHER end of the same problem. §2.2 catches a second copy of a decision; this catches a copy with no callers at all, which is how the third duplicate found today (lowestSectionId) came to exist." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-09-21T12:04:00Z",
    "why_it_governs": "Everything is an event, append-only; entity state is derived by replaying the record.",
    "how_this_build_will_embody_it": "emit.ts writes into that chain and has no caller, so a branch of the §3.1 record simply stopped being written in June. The chain is intact; it is just no longer being fed." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T13:26:00Z",
    "why_it_governs": "Default to proposing and explaining rather than silently rewriting; ask what the intended outcome is before assuming it, and never take a decision that belongs to the human.",
    "how_this_build_will_embody_it": "Why the six orphans were classified and reported rather than deleted. Three are debt and two of those are somebody's deliberate design; removing them because an audit went red would be the agent overtaking a decision that is not its own." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T12:45:00Z",
    "why_it_governs": "Hard metrics must stay objective and defensible; measuring agreement instead of consequence is grading your own homework.",
    "how_this_build_will_embody_it": "The emit.ts finding IS this clause failing quietly. The coach readout's accept rate is not measuring the wrong thing — it is measuring nothing, because its input stopped in June, and it looks exactly the same as when it worked." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-394", "read_at": "2026-09-21T14:50:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "A dead instrument is worse than an invisible one: the readout still renders, so a reader sees evidence of learning that stopped three months ago." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-21T15:55:00Z",
    "why_it_governs": "A method counts as learned ONLY when measured against the alternative with before/after rigor; the System must refuse to believe its own evolution until results prove it.",
    "how_this_build_will_embody_it": "The coach readout is the §4 instrument — the thing that would tell anyone whether the coaching method works. It has been reading events nothing writes since June, which means the clause's gate has had no input for three months while appearing to have one. That is the trap §4 describes, at the level of the instrument rather than the method." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-09-21T12:35:00Z",
    "why_it_governs": "The biggest risk is the builder under pressure making it less honest for a faster result.",
    "how_this_build_will_embody_it": "The whole allowlist is this risk. Six entries would turn a red gate green in ninety seconds; three of them are genuine debt and say DEBT, with the date and the live consequence, so the list states what is owed rather than hiding it." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-09-21T12:30:30Z",
    "why_it_governs": "A decision for the founder is a picker.",
    "how_this_build_will_embody_it": "Retiring emit.ts together with the v3 readout is a decision about a live admin surface and is NOT taken here — it is written into the allowlist entry and the residual so the founder can make it on the evidence." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-462", "read_at": "2026-09-21T12:32:00Z",
    "why_it_governs": "Labels without content produce work in the language of the discipline that violates it.",
    "how_this_build_will_embody_it": "Detector bug 1 is this, literally: a COMMENT mentioning a module counted as importing it. The mention carried the name of a dependency and none of the substance." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "Citing from cached memory rather than an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "The claim that emit.ts was deliberately retired was checked against the actual June commit message rather than inferred from the file being old." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "A lesson recorded only in PROSE will return; a fix is complete when the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The clause that produced this build. Three orphans found by hand in one day is exactly the prose-only state this clause describes, and the gate is the terminal step." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-799", "read_at": "2026-09-21T15:15:00Z",
    "why_it_governs": "Schema-complete is not built — the seam where a correct system silently becomes a nonexistent feature, and it must be GATED, not watched.",
    "how_this_build_will_embody_it": "The clause says gated, not watched, in its own title. Until today this class was watched." },
  { "id": "A33", "source_file": "ThinkerThinker.md", "line_range": "852-858", "read_at": "2026-09-21T13:56:00Z",
    "why_it_governs": "A gate must be PRECISE or not exist; a noisy gate is worse than an honest doc.",
    "how_this_build_will_embody_it": "The reason two detector bugs were fixed rather than allowlisted around. A gate that called tailwind's design tokens an orphan would be skipped within a week, and then a real orphan would ride in behind the noise." },
  { "id": "A36", "source_file": "ThinkerThinker.md", "line_range": "923-944", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "The residual is the highest-yield queue.",
    "how_this_build_will_embody_it": "Seventh consecutive build from what the record already admitted. This one turns the admitting into something automatic." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1012", "read_at": "2026-09-21T12:06:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran.",
    "how_this_build_will_embody_it": "The gate's own effectiveness is a claim about a command: a module nothing imports was planted, the gate failed, it was removed, the gate passed. Recorded rather than asserted." }
]
```
