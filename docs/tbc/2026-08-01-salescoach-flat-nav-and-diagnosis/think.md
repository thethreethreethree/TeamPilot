---
tbc_version: 1
trigger: feature
started_at: 2026-08-01T09:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — Sales Coach flat nav (founder decision) + the "edits don't stick" diagnosis

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md).

## 2. Why — the retrospective diagnosis (§1.2) drove this

Founder reported edits not landing "regardless of the revisions made." Looking BACKWARD at the actual code
(not theorising): the crossed-out texts are already gone; prod serves the latest commit. So the origin is NOT
a failed edit — it is (a) mode-specific edits (Standard-only relabels that an Expert-mode founder never saw),
(b) stale PWA bundle / non-canonical host, (c) duplicated copy in hidden tooltips. Full write-up:
docs/audits/2026-08-01-salescoach-stale-client-and-edits-diagnosis.md.

The nav is the first concrete fix for cause (a): the "Strategy → One Liners" label + the whole nav were
per-mode / grouped; the founder confirmed a FLAT list (July-28 PDF order) with a UNIVERSAL "One Liners" label.

## 3. Design + interconnection (§1.5.1 layer-4, layer-1)

- Collapse NAV_SECTIONS to a single headerless section = a flat render (no headers, no numbering) — layer-4
  matches the founder's PDF. Item gating unchanged (Coach Assessment + Team stay managerOnly via
  filterManagerNavSections — a rep never sees them). Kept Team Chat + KPI Analytics (real features built after
  the July-28 list) before Settings, flagged to the founder.
- Removed the per-mode relabel + its `useExperienceMode`/`isStandard`/`ii` (now dead) so "One Liners" shows in
  BOTH modes — directly closing cause (a) for the nav.

## 4. Hypothesis

- **H1:** a single headerless NAV section renders as a flat, unnumbered list with a universal "One Liners"
  label, manager gating intact, typecheck clean, and the managerNav helper tests still green.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-08-01T09:00:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned by verifying the CURRENT code state before acting — I proved the edits are live, then diagnosed the real origin.", "how_this_build_will_embody_it": "The diagnosis doc + section 2." },
  { "id": "§0.1",   "read_at": "2026-08-01T09:00:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH via sha256sum." },
  { "id": "§1.2",   "read_at": "2026-08-01T09:00:00Z", "source_file": "CLAUDE.md", "line_range": "44-52",   "why_it_governs": "Retrospective identification — the origin came from reading the record (the code + prod health), not forward theory.", "how_this_build_will_embody_it": "The diagnosis names causes grounded in grep results." },
  { "id": "§1.5.1", "read_at": "2026-08-01T09:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Layer-4 (nav label ↔ page title consistency) — the flat universal label matches the surface the founder sees.", "how_this_build_will_embody_it": "One Liners is universal; nav is flat per the PDF." },
  { "id": "§1.5.2", "read_at": "2026-08-01T09:00:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — I searched every crossed-out string + the version mechanism before concluding.", "how_this_build_will_embody_it": "check.md records the grep + version-mechanism trace." },
  { "id": "§6",     "read_at": "2026-08-01T09:00:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced what the nav change affects (gating helper, mode hooks).", "how_this_build_will_embody_it": "closure notes the bounded blast radius." },
  { "id": "A19",    "read_at": "2026-08-01T09:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across entries." },
  { "id": "A22",    "read_at": "2026-08-01T09:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + the Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-08-01T09:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "128-132", "why_it_governs": "Don't ship a half-thing — manager gating must stay intact through the flat refactor.", "how_this_build_will_embody_it": "filterManagerNavSections still filters; tests green." },
  { "id": "A38",    "read_at": "2026-08-01T09:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes typecheck + test output." }
]
```
