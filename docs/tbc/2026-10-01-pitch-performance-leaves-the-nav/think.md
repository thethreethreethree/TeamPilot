---
started_at: 2026-10-01T12:30:00Z
trigger: Founder, pickers 2026-10-01 - REV 1's "Take out today's performance" is the Pitch Performance tab (app done, eacdd648); "Match it on the website"; and the Macro Mode explanation in REV 1 wording on the website too.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - Pitch Performance leaves the website's nav

## The problem, from the record

- REV 1 page 3: "Take out today's performance (that's what the home page is)". The founder ruled out the
  Today's Metrics tab, then named Pitch Performance, and chose website parity.
- The website shows Pitch Performance in `MACRO_MOBILE_TABS` (SalesCoachShell.tsx) and as the third
  desktop link in `MacroModeToggle.tsx`. Those were the page's only standing ways in; the Door Log offered
  only "View last pitch result", right after a save. Removing both without a replacement strands the page.
- The Macro card still read "Door-to-door: fast Door Log + a macro Report Card..." in both positions; the app
  shows the founder's REV 1 sentences (macro-mode-copy.ts).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-01T13:08:08Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "What 'today's performance' meant was read from REV 1 itself (page 3) and from the earlier picker in this session's record before anything changed; the founder then named the tab."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-01T13:08:08Z",
    "why_it_governs": "Methodology in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "Both documents are in the tree; this manifest's reads were printed after the build began (CLAUDE.md lines cut at 300 characters)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-01T13:08:08Z",
    "why_it_governs": "Four layers in order; layer 3 is whether the rep can still reach pitch history.",
    "how_this_build_will_embody_it": "L3: removing the tab would have stranded the website's Pitch Performance page, whose only standing ways in were the tab and the Macro card. The Door Log gains 'See how your pitches went', as the app's Door Log has. L4: both changed surfaces captured and opened in both themes."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-01T13:08:08Z",
    "why_it_governs": "Audit as you work; surface adjacent problems.",
    "how_this_build_will_embody_it": "Capturing the Macro card exposed that the website still showed the pre-REV-1 explanation; raised in a picker (founder: use the REV 1 wording) and fixed in this build."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-10-01T13:08:08Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "Three founder decisions, each through a picker: which screen REV 1 meant, website parity for the tab, and website parity for the Macro sentence."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-01T13:08:12Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Paragraph openings printed at the recorded time; the full text was read at 05:03Z the same day."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-10-01T13:08:12Z",
    "why_it_governs": "Citation needs an in-session read.",
    "how_this_build_will_embody_it": "Only clauses printed after this build began are cited by it."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-01T13:08:12Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "salesCoachShellNav.test.ts fails if the tab returns (mutation caught); macroModeCopy.test.ts pins the founder's exact words and that the old line is gone."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-01T13:08:12Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check by name with its exit code in check.md."
  }
]
```
