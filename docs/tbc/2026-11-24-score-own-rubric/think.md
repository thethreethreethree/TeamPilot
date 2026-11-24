---
started_at: 2026-11-24T20:15:48Z
trigger: Found while reading the scorer for the founder-approved N/A build (picker "Managers, when correcting"): corrections and Search assume the door rubric for phone/video scores.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A score is corrected and read under its own rubric

## The record

- recomputeWithOverride called scorePitch with no rubric (door default) and filtered elements by the door table;
  applyOverride's known-item check and points used the door table.
- Phone/video rubric attfiber-remote-v1: remote-only intro.reasonForCall, intro.newAtAddress, intro.permissionAgenda,
  disc.guidedSpeedTest, close.enrollOnCall, bonus.decisionMakerJoins, bonus.referralNamed, bonus.localProof.
  Shared ids have identical labels (checked with a script).
- Production (counts only): 52 scores, all attfiber-v1; 0 overrides — nothing to repair.
- Remote Sales Search offers REMOTE_ELEMENTS but parseCallSearch validated with the door table.

## Outside view

The bug was invisible because no phone/video call had been scored and corrected yet; the first one would silently
lose points and write the wrong total into an append-only log.

## Design

rubricByVersion(rubricVersion) for anything that computes; elementInAnyRubric / bonusInAnyRubric / violationInAnyRubric
and itemKindInAnyRubric for readers that only label or classify.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "Found while reading the scorer for the N/A build: score corrections and Search use the door rubric's tables for every score; the phone/video rubric (approved 2026-11-22) has five items and three bonuses the door rubric lacks.",
    "how_this_build_will_embody_it": "Confirmed by tests failing on the old code and a production count (0 remote scores, 0 corrections) before changing anything."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-24T20:15:49Z."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "Holistic: eighteen files read the door rubric; some do arithmetic, some only show labels, one (pattern detection) runs on door scores only by design.",
    "how_this_build_will_embody_it": "Arithmetic uses the score's own rubric; display readers use an any-rubric lookup (shared ids verified identical); pattern detection recorded as a residual."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "69-80",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "Layer 2 and 3: a manager correcting one item on a phone call expects the total to move by that item only, then the rep reads the corrected score; a recompute that drops phone-only items breaks both.",
    "how_this_build_will_embody_it": "The correction moves the score by the corrected item alone (test: 100 → 96 for a 4-point item), and the rep's alert names it by the right rubric's label."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "Look past the task: the same class (door-only table for a remote score) was searched for across every importer.",
    "how_this_build_will_embody_it": "Found and fixed the live Search bug (phone-only item refused as unknown) and the dispute queue offering no correction."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "External config can leave a feature silently empty.",
    "how_this_build_will_embody_it": "None: no migration or external config."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "A stored score's rubric_version is the authority on which rubric it was made under; re-deriving 'the rubric' as the door default duplicated that decision and drifted when a second rubric arrived.",
    "how_this_build_will_embody_it": "rubricByVersion(pitch.rubricVersion) is consumed by the recompute, the known-item check, the points log, the reader and the alert label."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "Overrides are append-only rows; a wrong recompute would write a wrong total permanently into the record.",
    "how_this_build_will_embody_it": "Fixed before the first phone/video correction exists (0 in production)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "None needed: a correctness bug against an approved rubric, not a choice."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "applyOverride tests fail on the old code (mutation-checked) and pin a phone/video correction; search test pins a phone-only element."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-24T20:15:49Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
