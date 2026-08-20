---
title: Schedule export — colour-coded visual redesign + custom schedule name (AMD-012 remediation)
build_plan: ScheduleManagementSystem.md
phase: 5 (grid export) — the founder's explicit visual requirement
started_at: 2026-08-20T13:30:00Z
manifest_entries: 15
---

# Colour-coded schedule export + custom name

Founder direction (2026-08-20): the Print/Download export shipped CORRECT but monochrome. The founder had
explicitly required "colors elements, design concept/element, a graphic element that is very easy to
understand" and asked *"Why did you ignore my instruction?"* — then directed the AMD-012 amendment (a
user-specified experience is layer-2, not waivable polish) AND a custom schedule name (default was the company
name "Elostate"). This build is the remediation: it delivers the specified visual experience and the custom
name.

## Step 2 — Session-read manifest (A22 / §0.1)
```json
[
  { "id": "§0",     "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",   "why_it_governs": "Understanding precedes solving — the export was a misdiagnosis (design filed as polish), not a code gap.", "how_this_build_will_embody_it": "The diagnosis (user-specified experience = layer 2) drove the build; the amendment names WHY the failure happened before the fix was written." },
  { "id": "§0.1",   "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Precondition gate — methodology in the working tree, read + hash-verified this session before writing.", "how_this_build_will_embody_it": "DOC_MANIFEST.json was regenerated + verified (tbc:docs green) as part of the AMD-012 commit that precedes this build." },
  { "id": "A19",    "read_at": "2026-08-20T13:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in the working tree, read this session — not cited from cache.", "how_this_build_will_embody_it": "ThinkerThinker.md is in-tree; A41/A42/A34/A22/A30 were opened + read this session (timestamps here)." },
  { "id": "A38",    "read_at": "2026-08-20T13:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1020", "why_it_governs": "'Verified' is the canonical command run by name — not a self-scoped subset.", "how_this_build_will_embody_it": "check.md names `npm run check` (exit 0) as the gate, plus the visual read the failure specifically demanded." },
  { "id": "§1.5.1", "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "78-138",  "why_it_governs": "Four-layer sieve — the export's layer-2 (does it deliver the intended result) was mis-read as satisfied when only the mechanism worked.", "how_this_build_will_embody_it": "The visual result is the intended result here; the build makes layer 2 actually pass, verified by a rendered screenshot, not by 'it renders'." },
  { "id": "§1.5.3", "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "175-197", "why_it_governs": "External-config completeness — the custom-name WRITE depends on migration 0234 being applied (a precondition the code alone can't satisfy).", "how_this_build_will_embody_it": "The read path DEGRADES (guarded fallback → company name) if 0234 is unapplied; the write path is FLAGGED to the founder as a blocking precondition (db:apply could not reach the DB from here)." },
  { "id": "§1.5.4", "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "198-224", "why_it_governs": "The clause this build was born from — a user-specified experience binds at layer 2 and cannot ship as deferred polish.", "how_this_build_will_embody_it": "The colour-coding IS the deliverable; it is built, not deferred, and verified visually before claiming done." },
  { "id": "§1.5.2", "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "175-197", "why_it_governs": "THINK hypotheses before searching — form what could fail, then confirm.", "how_this_build_will_embody_it": "Hypotheses H1-H3 were written first; H1 (the colours must render distinct + legible) was the load-bearing one and was confirmed by reading the rendered PNG." },
  { "id": "§3.1",   "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "251-266", "why_it_governs": "Additive, safe-to-re-run migrations; entity state stays derived.", "how_this_build_will_embody_it": "0234 is `add column if not exists` nullable — additive, safe-to-re-run (A12), and it touches only a display label, never derived schedule state." },
  { "id": "§6",     "read_at": "2026-08-20T13:40:00Z", "source_file": "CLAUDE.md", "line_range": "24-70",  "why_it_governs": "Reuse — do not fork the settings read/write or the render.", "how_this_build_will_embody_it": "schedule_name rides the EXISTING companies-row settings pattern (mirrors timezone/workweek_start incl. the guarded fallback); the render is the one shared renderCanvas Print + Download already share." },
  { "id": "A34",    "read_at": "2026-08-20T13:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "871-897", "why_it_governs": "Migration-coupled reads must DEGRADE, never assert applied.", "how_this_build_will_embody_it": "getScheduleSettings adds schedule_name to the isMissingColumnError set → a pre-0234 DB returns defaults (name=null → company name), no crash." },
  { "id": "A41",    "read_at": "2026-08-20T13:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "1057-1075", "why_it_governs": "A feature depending on external config isn't done on a green build — verify or FLAG.", "how_this_build_will_embody_it": "The migration-apply precondition is surfaced to the founder explicitly (it failed to connect here), not silently assumed." },
  { "id": "A42",    "read_at": "2026-08-20T13:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "1083-1099", "why_it_governs": "The asset for THIS failure — user-specified experience is the result, not polish.", "how_this_build_will_embody_it": "The build delivers the named experience (colour, legend, design, custom name) and verifies it visually — the exact gap A42 names." },
  { "id": "A22",    "read_at": "2026-08-20T13:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-635", "why_it_governs": "Session-read manifest before closure.", "how_this_build_will_embody_it": "This manifest pairs each cited clause with its in-session read; tbc:manifest enforces it." },
  { "id": "A30",    "read_at": "2026-08-20T13:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-790", "why_it_governs": "Encode the lesson in a gate, not just prose.", "how_this_build_will_embody_it": "The colour classification (the real logic) is locked by shiftColors.test.ts; a band boundary regression fails the gate. The lesson itself is gated by CLAUDE.md §1.5.4 + §6.5d (verify-docs) from the AMD-012 commit." }
]
```

## Understanding
The export was mis-scoped: "design" was filed under layer-4 polish when the founder had made it the intended
result (layer 2). The fix has two parts:

1. **Visual result (no migration needed, works on deploy):** a pure, tested colour system (`shiftColors.ts`)
   classifies each shift into a time-of-day band (morning/day/evening/overnight) + time-off; `renderCanvas`
   draws a branded header band, a colour legend, weekend-tinted columns, and colour-coded rounded shift pills.
   A manager reads "who works nights vs mornings" at a glance — the founder's ask.

2. **Custom name (migration-coupled):** `companies.schedule_name` (0234, nullable) titles the export; NULL
   falls back to the company name. Rides the existing settings pattern with a guarded fallback (A34) so the
   read is correct pre- or post-migration; the write depends on 0234 being applied — flagged (A41/§1.5.3).

## Hypotheses (§1.5.2)
- H1 (load-bearing): the colour bands must actually render distinct + legible on the export — verified by a
  headless screenshot (Read the PNG), not by "the code runs". CONFIRMED.
- H2: a pre-0234 DB must not crash the schedule read — the guarded fallback covers it (A34). Held by code.
- H3: the custom name write fails until 0234 is applied — TRUE; surfaced as a founder precondition, not hidden.
