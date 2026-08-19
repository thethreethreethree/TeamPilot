# Layer-2 finding — the import does not fit the founder's ACTUAL sample files

> Outside-view (1.3) + operational-effectivity (1.5.1 layer 2). Found 2026-08-19 while verifying the
> Schedule import against the real inputs the founder provided, not synthetic test fixtures. This is the
> "passes in test, fails on the real input" failure class — surfaced BEFORE the founder hits it.

## The finding

The CSV import (Phase 5) works end-to-end for **staff × date grids of shift-codes** — the shape of the
HK / HUB SCHED / frendz samples the parser was built against (`gridParser.ts` header). But the founder's
stated sample files are a **different data model**, and the import cannot read them OR parse their shape.

**The founder's actual samples** (in Downloads):
- `VA_Weekly_Schedule.docx` — Microsoft Word
- `VA_Weekly_Color_Grid.pdf` — PDF (same content, color-coded)

**Their shape** (verified by extracting both):

```
Time        Alex     Kaye     Nikko   Joanne
5-8 AM                                 On Duty
8-10 AM                       On Duty  On Duty
10-12 PM    On Duty           On Duty  On Duty
12-1 PM     On Duty                    On Duty
...
11 PM-2 AM           On Duty  On Duty
2-3 AM                        On Duty
```

## Two distinct gaps

| gap | current state | what the VA format needs |
|-----|---------------|--------------------------|
| **File type** | CSV only | `.docx` and `.pdf` reading |
| **Grid shape** | staff (rows) × date (cols) × shift-code (cell) | **time-block (rows) × staff (cols) × "On Duty" (cell)** |
| **Time model** | specific ISO dates in the header | **recurring weekday template** (Mon–Fri), no dates |
| **Shift derivation** | one cell = one coded shift | **coalesce a staff member's contiguous "On Duty" blocks into one shift** (Alex 10-12PM + 12-1PM → one 10AM–1PM shift) |
| **Overnight** | within-day | blocks cross midnight (11PM–2AM, 2–3AM) — ties to RQ4 tz |

The grid-shape difference is the substantive one: the VA format is a **daily coverage grid** (who is
present during each time-block), not a **weekly assignment calendar** (which shift each person works each
day). Converting one to the other is a real modeling step, not a format tweak.

## Why this is surfaced, not silently built (3.3 / OPTION-BASED control)

Rebuilding the parser for the VA shape embeds decisions the founder owns:
- Is the VA grid a **recurring template** (every Mon–Fri) or a specific week? (It reads as recurring.)
- How should contiguous "On Duty" blocks coalesce into shifts across the midnight boundary?
- Are BOTH formats in scope long-term, or is the VA presence-grid now the canonical one?

Silently picking these would be the section-5 "confident, well-formed failure" — building the wrong thing fast.

## Options (founder decides)

1. **(Recommended) Add a second importer for the VA presence-grid shape, CSV-first.**
   Model it as a recurring weekday template; coalesce contiguous "On Duty" blocks per staff into shifts.
   Start by accepting a CSV export of this grid (deterministic, testable now), and treat `.docx`/`.pdf`
   reading as a separable follow-up (option 3). Lowest risk: the shape work is the hard part and is
   file-format-independent. *Needs your confirm on the recurring-template + block-coalescing rules.*

2. **Keep only the staff × date shift-code importer; the VA grid is entered via the roster/grid UI, not imported.**
   No new parser. The founder's VA sample becomes a manual-entry case. Least build, but the "upload your
   existing schedule" promise doesn't cover the founder's own format.

3. **Full: `.docx` + `.pdf` reading AND the VA presence-grid parser.**
   Adds a doc/pdf extraction dependency (the existing `extractText` path may cover PDF; `.docx` needs a
   reader) on top of option 1's shape work. Most complete, most surface area / dependency risk.

## Recommendation

**Option 1.** The grid-*shape* mismatch is the real blocker (a `.docx`/`.pdf` reader is useless if the
parsed grid is then misinterpreted), and it is buildable + testable now from a CSV of the VA grid without
any new dependency. Land the shape correctly first; add `.docx`/`.pdf` reading (option 3) as a clean
follow-up once the shape is proven against the founder's real data.

## Status

Flagged, not built — this is a design decision under OPTION-BASED control. The staff × date shift-code
importer remains correct + shipped for that shape. No code changed by this finding.
