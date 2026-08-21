---
started_at: 2026-08-22T02:56:30+08:00
---

# THINK — Trend tile shows the balance ratio (completeness)

The trend direction now factors in balance, but the tile's three stats were owned/focused/DECISIONS — showing a
non-directional count (decisions/mtg) while HIDING the balanced ratio that actually drives the direction. Fixed:
the three stats are now the three direction-driving quality ratios (owned, focused, balanced), so what the
"improving/slipping" label is based on is visible. `pct(null)` → "—" when unrecorded.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Understanding precedes solving — the tile should show the signals that produce its verdict.",
    "how_this_build_will_embody_it": "The three shown stats are exactly the three ratios the direction is computed from." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Layer-4 — the surface should match the substance (show what drives the label).",
    "how_this_build_will_embody_it": "Swapped the non-directional decisions/mtg stat for the balanced ratio." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Notice the small mismatch (hidden direction-driver) and fix it.",
    "how_this_build_will_embody_it": "Caught that balance drove the direction but wasn't shown; now it is." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the mismatch, traced ripple (one tile), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session (02:57)." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Encode the lesson — theme legibility caught by theme:audit; the tile stays token-based.",
    "how_this_build_will_embody_it": "The changed Stat uses the same theme tokens (theme:audit green)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3607 tests, exit 0), pasted in check.md." }
]
```
