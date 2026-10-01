---
started_at: 2026-10-01T14:20:00Z
trigger: The app's American-spelling guard (app 79b72b44) applied to the website found 8 hits; REV 1 set American spelling for the product.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - American spelling on the website

## The record

Scanning every website .tsx, comments blanked: "practise" (after-pitch), "Reps practising" (Training),
"cost centre" x4 (Finance, whose field is `cost_center`), "Coach analyses" (correct American plural, kept),
"an analysed pitch" (a test capture's name, not seen by anyone).

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The scan ran before any change: 8 hits, each classified (a real British form, a correct American noun, or a test capture name). Read at the recorded time: §0 and §0.1 in full; the others' openings (full texts read at 13:08Z today)."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashed in the front matter. Read at the recorded time: §0 and §0.1 in full; the others' openings (full texts read at 13:08Z today)."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "Four layers; layer 4 is the words on the surface.",
    "how_this_build_will_embody_it": "Copy only: no layout or behaviour changed; the website now spells as the app does. Read at the recorded time: §0 and §0.1 in full; the others' openings (full texts read at 13:08Z today)."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "Audit as you work; a fix in one product should be looked for in its twin.",
    "how_this_build_will_embody_it": "Found by applying the app's new spelling guard to the website. Read at the recorded time: §0 and §0.1 in full; the others' openings (full texts read at 13:08Z today)."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No founder decision: REV 1 already set American spelling. Read at the recorded time: §0 and §0.1 in full; the others' openings (full texts read at 13:08Z today)."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Openings printed at the recorded time; full text read at 05:03Z today."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "Citation needs an in-session read.",
    "how_this_build_will_embody_it": "read_at is the print time; what each print covered is stated."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "americanSpelling.test.ts fails on a reintroduced British form at its line (mutation caught)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-01T14:26:35Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check by name, with its exit code, in check.md."
  }
]
```
