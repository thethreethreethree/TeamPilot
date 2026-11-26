---
started_at: 2026-11-26T02:29:57Z
trigger: docs/tbc/2026-11-26-review8-fixes R1-single-rep-503.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A failed tree check says so

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-20",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Residual R1-single-rep-503 (review8): the single-rep views and role changes answered a failed tree check with 'not in your team', telling an allowed manager something false.",
    "how_this_build_will_embody_it": "treeAllowsRepChecked returns null on failure; those routes answer 503 'couldn't check'."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
    "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T02:30:31Z, after started_at."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "64-76",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Holistic: treeAllowsRep is used by other routes that want fail-closed booleans; changing it would change them all.",
    "how_this_build_will_embody_it": "A sibling helper; treeAllowsRep is unchanged."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-100",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Layer 2: a wrong 404 sends a manager looking for a rep who is in fact on their team.",
    "how_this_build_will_embody_it": "A 503 with 'Try again'."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-158",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Adjacent: invariant 36 matches the helper names; a new name would be flagged as no tree check.",
    "how_this_build_will_embody_it": "Its pattern accepts treeAllowsRepChecked."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-180",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "No configuration outside the repository is involved.",
    "how_this_build_will_embody_it": "None needed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-316",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "'Couldn't answer' is a different verdict from 'no'; folding them together re-decides it.",
    "how_this_build_will_embody_it": "Three outcomes: allowed, not allowed, unknown."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Authorization reads only; no write or event changes.",
    "how_this_build_will_embody_it": "No table or write."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-361",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "No customer text is involved.",
    "how_this_build_will_embody_it": "Nothing new for erasure to reach."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-379",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "A person told a rep is not on their team when the check merely failed is misled about their own team; the system must not assert what it could not check.",
    "how_this_build_will_embody_it": "'Couldn't check your team right now.'"
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-456",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
    "how_this_build_will_embody_it": "No new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Methodology in the working tree, consulted not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-598",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "A 503 route test; the audit pattern covers the new helper."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1005",
    "read_at": "2026-11-26T02:30:31Z",
    "why_it_governs": "Verified is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md names each command with its result."
  }
]
```
