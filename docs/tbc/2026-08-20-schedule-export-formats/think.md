---
title: Schedule export — PDF / Excel / CSV formats, re-importable, landscape
build_plan: ScheduleManagementSystem.md
phase: 5 (grid export) — founder request 2026-08-20
started_at: 2026-08-20T15:30:00Z
manifest_entries: 12
---

# Multi-format, re-importable schedule export

Founder direction (2026-08-20): "print and download needs … pdf excel or csv … so it can be imported back to
the system … our system should be able to account for these files. the layout should also be in landscape."
Founder chose (AskUserQuestion) BOTH PDF variants: a colour visual PDF + a re-importable data PDF.

The load-bearing requirement is the ROUND-TRIP: an exported file must re-import to the same schedule. So the
export shape is dictated by the importer, not invented — understand the import pipeline first (§0), then emit
exactly what it reads back.

## Step 2 — Session-read manifest (A22 / §0.1)
```json
[
  { "id": "§0",     "read_at": "2026-08-20T15:35:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Understanding precedes solving — the round-trip only works if the export matches what the importer expects.", "how_this_build_will_embody_it": "Read csvGrid/gridParser/staffDateXlsx/staffDatePdf BEFORE writing the exporter; the grid shape (ISO header + HH:mm-HH:mm cells) is derived from the parsers, and a round-trip test proves it." },
  { "id": "§0.1",   "read_at": "2026-08-20T15:35:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "Precondition gate — methodology in the working tree.", "how_this_build_will_embody_it": "DOC_MANIFEST verified green this session (prior AMD-012 commit); both governing docs in-tree." },
  { "id": "§1.5.1", "read_at": "2026-08-20T15:35:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer sieve — an export button is worthless if the file it makes can't actually be re-imported (layer-2 effectivity).", "how_this_build_will_embody_it": "Each format is proven end-to-end: CSV/XLSX/PDF-data are round-trip tested against the REAL readers (parseCsvToGrid, xlsxToCsv, unpdf) → parseScheduleGrid → same shifts." },
  { "id": "§1.5.4", "read_at": "2026-08-20T15:35:00Z", "source_file": "CLAUDE.md", "line_range": "198-224", "why_it_governs": "A user-specified experience (landscape, colour visual, the three formats) is the intended result, not polish.", "how_this_build_will_embody_it": "Landscape print + colour visual PDF + the exact formats the founder named are all built, not deferred." },
  { "id": "§3.4",   "read_at": "2026-08-20T15:35:00Z", "source_file": "CLAUDE.md", "line_range": "327-360", "why_it_governs": "Honesty — no guessed import mapping; unknown codes surface.", "how_this_build_will_embody_it": "autoTimeRangeCodeMap maps ONLY unambiguous explicit-time cells (with a colon) + OFF; an org code like '6-3' stays 'needs mapping' (never guessed). The PDF reader is deterministic (ISO header), no LLM." },
  { "id": "§6",     "read_at": "2026-08-20T15:35:00Z", "source_file": "CLAUDE.md", "line_range": "24-70", "why_it_governs": "Reuse — don't fork CSV writing, zip, or the readers.", "how_this_build_will_embody_it": "CSV rides the shared toCsv + csvSafe (CWE-1236); xlsx uses the already-shipped jszip + writes inlineStr the repo's own reader ingests; PDF uses the repo's unpdf import path." },
  { "id": "A19",    "read_at": "2026-08-20T15:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "TT.md in-tree; A31/A22/A30 opened + read this session." },
  { "id": "A22",    "read_at": "2026-08-20T15:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-635", "why_it_governs": "Session-read manifest before closure.", "how_this_build_will_embody_it": "This manifest pairs each cited clause with its in-session read." },
  { "id": "A30",    "read_at": "2026-08-20T15:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-790", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "The round-trip is LOCKED by tests (export → CSV/XLSX/PDF → real readers → same shifts); a format regression fails the gate, not a human." },
  { "id": "A31",    "read_at": "2026-08-20T15:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-817", "why_it_governs": "Schema-complete ≠ built — the seam is where a feature silently doesn't exist.", "how_this_build_will_embody_it": "The write seam (export buttons → file) AND the read-back seam (file → import parsers) are BOTH asserted, in build.md and by tests." },
  { "id": "A38",    "read_at": "2026-08-20T15:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1020", "why_it_governs": "'Verified' is the canonical command by name.", "how_this_build_will_embody_it": "check.md names `npm run check` (exit 0) + the round-trip tests against the real readers." },
  { "id": "§1.5.2", "read_at": "2026-08-20T15:35:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK about what could fail BEFORE building — the load-bearing risk here is whether a generated file's bytes actually extract back through the real readers, not whether the code compiles.", "how_this_build_will_embody_it": "Hypotheses H1-H3 were written first; H1 (the data-PDF round-trips through unpdf) was the risky one and was confirmed against the REAL extractor before trusting it, rather than assumed." }
]
```

## Understanding
The importer converges every format on `parseScheduleGrid({ headerDates, rows, codeMap })`. So the export must
produce a staff × date grid whose header resolves to ISO dates and whose cells are recognizable shift codes. By
emitting EXPLICIT "HH:mm-HH:mm" cells + ISO-date headers, the re-import is fully deterministic:
`autoTimeRangeCodeMap` maps the explicit-time cells with no LLM/human step. CSV and XLSX are exact grids; the
data-PDF writes the same grid as positioned text with an ISO header, read back by a new generic ISO reader
(`pdfIsoGrid`) that the PDF import tries before the frendz layout parser. The visual PDF + PNG are the colour
graphic (human view); landscape is set for print + PDF.

## Hypotheses (§1.5.2)
- H1 (load-bearing): the data-PDF's text layer extracts back cleanly through unpdf into the same grid. CONFIRMED
  by a test that runs the REAL unpdf extractor on our generated PDF → same shifts.
- H2: our xlsx (inline strings, no shared-strings table) is ingested by the repo's own xlsx reader. CONFIRMED by
  a write→read round-trip test.
- H3: explicit-time auto-mapping must not swallow ambiguous org codes ("6-3"). Held: the regex requires a colon
  on both sides; "6-3" is left unmapped.
