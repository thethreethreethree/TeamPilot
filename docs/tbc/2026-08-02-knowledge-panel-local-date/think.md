---
tbc_version: 1
trigger: fix
started_at: 2026-08-02T01:12:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — knowledge panel shows the UTC date, not the viewer's local date

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md). Both read this
session.

## 2. Why (§2 diagnose)
A UTC-day sweep (this class has surfaced 3× in this codebase) found one client-side outlier:
`AdaptiveKnowledgePanel.tsx:298` rendered a knowledge version's created date as
`new Date(v.createdAt).toISOString().slice(0,10)` — the UTC calendar date. For a viewer west of UTC, a version
saved in the evening reads a day AHEAD (e.g. 8pm PST → next-day UTC). Root cause: formatting a timestamp by
its UTC date instead of the viewer's local date.

## 3. This is an OUTLIER against an established convention (§1.5.2, A26)
The rest of the UI already formats dates locally: `FileCard.tsx:154` and `LiveCoachingPanel.tsx:296` use
`toLocaleDateString()`, and `components/chats/utils.ts:42` carries a comment explicitly warning against "the
UTC `createdAt.slice(0,10)`". The sweep found this was the SOLE client-display instance of the UTC-slice
pattern — the class is otherwise well-handled (a positive audit result). Class boundary = this one line.

## 4. Design
Replace with `toLocaleDateString("en-CA")` — yields a local `YYYY-MM-DD`, so the fixed-width `font-mono`
format is preserved while the date is the viewer's local one. Matches the codebase convention. No data, no
API, no schema change; a pure display correction.

## 5. Hypothesis
- **H1:** the version date now renders in the viewer's local `YYYY-MM-DD`; an evening-west-of-UTC timestamp no
  longer reads a day ahead; format stays `YYYY-MM-DD`; typecheck clean.

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-02T01:12:00Z", "source_file": "CLAUDE.md", "line_range": "12-24", "why_it_governs": "Understand before fixing — I read the render + the sibling conventions to confirm this is an outlier, not the intended format.", "how_this_build_will_embody_it": "Section 3 grounds it against FileCard/LiveCoachingPanel/chats-utils." },
  { "id": "§0.1", "read_at": "2026-08-02T01:12:00Z", "source_file": "CLAUDE.md", "line_range": "26-40", "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH." },
  { "id": "§2", "read_at": "2026-08-02T01:12:00Z", "source_file": "CLAUDE.md", "line_range": "150-170", "why_it_governs": "Diagnose before patching.", "how_this_build_will_embody_it": "Section 2 names the root cause (UTC date formatting)." },
  { "id": "§3.4", "read_at": "2026-08-02T01:12:00Z", "source_file": "CLAUDE.md", "line_range": "280-292", "why_it_governs": "Honesty — a date shown a day off is a small misrepresentation of the record.", "how_this_build_will_embody_it": "The fix shows the viewer's true local date." },
  { "id": "§1.5.2", "read_at": "2026-08-02T01:12:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — swept the whole codebase for the class, not just one file.", "how_this_build_will_embody_it": "Section 3 records the sweep + the positive result." },
  { "id": "§6", "read_at": "2026-08-02T01:12:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Decision checklist.", "how_this_build_will_embody_it": "Diagnosed, swept, matched the existing convention." },
  { "id": "A19", "read_at": "2026-08-02T01:12:00Z", "source_file": "ThinkerThinker.md", "line_range": "57", "why_it_governs": "Methodology in the tree.", "how_this_build_will_embody_it": "Confirmed present." },
  { "id": "A22", "read_at": "2026-08-02T01:12:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + trailer." },
  { "id": "A26", "read_at": "2026-08-02T01:12:00Z", "source_file": "ThinkerThinker.md", "line_range": "67", "why_it_governs": "A found bug is a CLASS — sweep it.", "how_this_build_will_embody_it": "Section 3 swept client-display date formatting; boundary = this one line." },
  { "id": "A30", "read_at": "2026-08-02T01:12:00Z", "source_file": "ThinkerThinker.md", "line_range": "91", "why_it_governs": "Encode the lesson where the future edit meets it.", "how_this_build_will_embody_it": "An inline comment states why local, not UTC-slice, matching the chats/utils warning." },
  { "id": "A38", "read_at": "2026-08-02T01:12:00Z", "source_file": "ThinkerThinker.md", "line_range": "95", "why_it_governs": "'Verified' = a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck output." }
]
```
