---
started_at: 2026-11-26T06:45:00Z
trigger: Independent review of 61368b2b..32a53099 — six findings (two medium).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the review of the folder, filler and tracker builds

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "An independent review of 61368b2b..32a53099 traced six defects: a folder with only subfolders had no Move (so a branch couldn't move); coverage still divided by calls a tracker never hears; 'uh-huh' counted as a filler; two concurrent moves could form a loop and the loop walk was unbounded; a move could make two same-named siblings; a one-type tracker's confirmation said 'phone and video'.",
    "how_this_build_will_embody_it": "Each fixed at its cause; the database guard re-tested on production in a rolled-back transaction (9/9)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections read at 2026-11-26T09:51:02Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "78-90",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Holistic: I fixed adoption's denominator last build but not coverage's — the same 'share of calls' rule in a second reader. The class is any reader that divides by calls for a tracker.",
    "how_this_build_will_embody_it": "Coverage now uses trackerAppliesTo per tracker; searched: adoption and coverage are the two readers."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Layer 3: moving a branch is the main reason to move a folder; a folder holding only subfolders had no control.",
    "how_this_build_will_embody_it": "Move in the 'Folders with no calls of their own' list."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Adjacent: the create guard and the move guard both read current parents; they needed the same lock, and a move needed the same 'no duplicate name' promise create already keeps.",
    "how_this_build_will_embody_it": "One advisory lock per library in both guards; the name check on move."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "0363 applied in production; verify:live passed. The review's deploy note (0361 before its code) was already met: 0361 was applied before 32a53099 was pushed.",
    "how_this_build_will_embody_it": "db:verify, db:apply, verify:live, the rolled-back probe."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Which calls a tracker counts on is one verdict (trackerAppliesTo); coverage re-derived it as 'every call'.",
    "how_this_build_will_embody_it": "coverageShare consumes it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "No rows are edited; guards are replaced functions, moves stay events.",
    "how_this_build_will_embody_it": "Append-only unchanged."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Erasure must reach every stored copy of a customer's words; these fixes store nothing new.",
    "how_this_build_will_embody_it": "Nothing for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Filler counts are shown without judgement; counting active-listening noises as fillers would mislead the rep.",
    "how_this_build_will_embody_it": "uh-huh / uh-oh excluded (tested)."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-391",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Honesty: a share that divides by calls a tracker can't hear understates it.",
    "how_this_build_will_embody_it": "Per-tracker denominators shown as 'n of N'."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every row was read at read_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate. Fixing adoption and not coverage is the lesson returning one build later.",
    "how_this_build_will_embody_it": "Tests: coverage by call type, uh-huh, Move from the no-calls list; the guard on production."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T09:51:02Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
