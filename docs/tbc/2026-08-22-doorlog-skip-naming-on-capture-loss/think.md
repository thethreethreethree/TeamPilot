---
started_at: 2026-08-22T04:33:00+08:00
---

# THINK — Door Log: skip the naming step when capture produced no audio (completes the capture-loss fix)

Follow-up to the capture-loss trust fix (commit 506a93d0). That fix guaranteed the OUTCOME is never lost when
audio capture fails — but the rep still walked through the "Name this pitch (Sold)" screen before the save,
and the typed name was then discarded (the fallback is a knock, which has no name). Naming a pitch that does
not exist is dead friction on the exact surface the founder called out ("we look pathetic"): §1.5.4 — the
founder made the field experience part of the deliverable, so a pointless intermediate screen is a layer-2/4
gap worth closing, not indefinitely-deferrable polish.

## The change

The blob is known at STOP (`recorded` is set there), so the "no audio" decision can be made at PICK time
instead of at SAVE time. `pickOutcome` now: no-mic → knock; **recorded-flow-with-no-blob → knock directly
(skip naming) with the honest amber "no audio to review" note**; otherwise → naming as before. The existing
`save()` knock-fallback stays as defense-in-depth for the LATE failure it still owns: a blob that existed at
pick but whose UPLOAD fails at save (that path still runs through naming, correctly, because audio was expected
to survive).

## Reuse / simplification (the /simplify altitude)

`logOutcomeKnock`, the new capture-loss branch, and (partly) the no-mic path all logged "an outcome as a knock,
then home". Consolidated into ONE `logKnockOutcome(outcome, { audioDropped })` helper — the no-mic path passes
no flag (the rep chose not to record), the capture-loss path passes `audioDropped: true` (the rep expected a
recording). One knock-logging tail, not three near-copies.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "Understanding precedes solving — the decision (no audio) is made where the fact is known (STOP), not re-checked late.",
    "how_this_build_will_embody_it": "pickOutcome branches on the already-known `recorded.blob`, skipping a screen that can't apply." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A38 via Read this turn (04:34)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "Layer-3/4 workflow continuity — a dead intermediate screen stalls the rep's flow.",
    "how_this_build_will_embody_it": "Capture-loss goes outcome → home in one tap, no phantom naming step." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "Proactive audit — while closing the trust bug, finish the flow it leaves behind + the 3-way duplication.",
    "how_this_build_will_embody_it": "Consolidated the knock-logging tail into one helper in the same pass." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "171-200", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "A user-specified experience binds at layer-2 — the founder made the field surface the point.",
    "how_this_build_will_embody_it": "The polished no-audio flow (no phantom naming) is treated as part of the result, not deferred." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: traced the flow, kept save()'s late-failure fallback, updated the guard test." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A38 via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "The capture-loss render test now asserts naming is SKIPPED and the knock is logged on pick." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T04:34:10+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check; exit-0 output pasted in check.md." }
]
```
