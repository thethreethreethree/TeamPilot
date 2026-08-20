# Schedule export & re-import — operator reference

_Last updated 2026-08-21. Covers the Grid → **Export** menu, how exported files re-import, and how to import a
schedule the app did **not** produce (a foreign PDF / Word / Excel)._

The schedule Grid (`/dashboard/schedule/grid`) exports the schedule in several formats, with a **This week /
All weeks** scope toggle. Formats split into two groups by purpose.

## Formats

### For viewing / printing (colour graphic — NOT re-importable)
| Format | What it is |
|---|---|
| **PNG image** | The colour-coded schedule graphic (shifts tinted by time of day + legend + custom name). One tall image; can't paginate. |
| **PDF (colour)** | The same graphic as a landscape PDF, **one week per page** — each page is a self-contained week (brand header + legend + that week's grid), so a page never breaks mid-week. |
| **Print** | Opens the browser print dialog with the colour graphic, landscape, **one week per page** (CSS page-breaks). |

These are images — they are for people to read, and do **not** re-import (an image has no data to read back).

### Re-importable data (staff × date grid)
| Format | Re-imports? | Notes |
|---|---|---|
| **CSV** | ✅ | Header = ISO dates, cells = `HH:mm-HH:mm`. No width limit — best for very wide schedules. |
| **Excel (.xlsx)** | ✅ | Same grid as a real spreadsheet. No width limit. |
| **PDF (data table)** | ✅ | A text table. Paginates wide schedules into column-groups and tall ones into row-pages, merged back by staff name on re-import. |

**Re-import** is via the normal Import screen (`/dashboard/schedule/import`) — upload the exported file. Because
the cells carry **explicit times** (`06:00-15:00`), the importer maps them **deterministically** — no
code-mapping step and no AI needed for a file we exported (`autoTimeRangeCodeMap`). Ambiguous org codes from a
*foreign* file (e.g. `6-3`, `GY`) still go through the confirm step.

## Importing a schedule the app did NOT produce (foreign PDF / Word / Excel)

You can import an existing schedule made elsewhere — any **staff × date** grid (staff down the side, dates
across the top, a shift code in each cell). The importer tries readers in order and **falls back** so a valid
grid it doesn't specifically recognize still imports:

1. **Our own exports** (ISO-date headers) — read straight back, deterministically.
2. **The "frendz" layout** (a day-number row + weekday row + a title month) — dates inferred deterministically.
3. **Generic fallback** — for *any other* layout (e.g. a `16 17 18 … 31` day-number header, or `AUG. 16`
   month+day columns, with codes like `6-3`, `7-4`, `2-11`, `OFF`, `GY`): the reader clusters the PDF's
   positioned text into columns and rows to reconstruct the grid, and **pre-fills as much as it safely can**:
   - **Dates** resolve **deterministically** — the month comes from the file (a `AUGUST` title cell or `AUG.`
     columns), the year is chosen so the schedule lands nearest today, and a non-date column like `TOTAL` is left
     blank. Only if no month is findable does it leave the dates for you to enter.
   - **Shift-code times** pre-fill for hours-only codes (`7-4` → 7am–4pm, `2-11` → 2pm–11pm) via a deterministic
     best-guess. Org-specific codes it must not guess (`GY` graveyard, `SKY-BAR`) are left for you to set once.
   You **confirm** the pre-filled dates + times before importing (guide-don't-overtake — a guess is shown, never
   applied silently).

**What to expect on upload of a foreign PDF:** the grid loads with the dates and most code-times already filled
and a note ("I filled in the dates from its month and day columns"). Check them, set any org-specific codes, then
**Preview → Import**. (If no month was in the file, you'll instead get "click **Analyze**" and the AI proposes
the dates for you to confirm.)

**Handled:** multi-**page** PDFs (rows grouped per page so pages never collide); per-cell coordinate jitter;
multi-word names kept in one column; a **split two-row header** (a month row + a day-number row are merged into
`AUG. 16` columns); **section-label rows** (`AM SHIFT` / `PM SHIFT`) dropped so they aren't read as staff; and a
**code wrapped across two lines** (`SKY-` + `BAR`) reunited. **Word (.docx) / Excel (.xlsx)** foreign grids take
a more reliable table-structure path (not positional) into the same confirm flow.

**Limits (fail honestly, not silently):** a name the PDF splits into tokens spaced *wider* than a column gap can
land in the wrong column — if a foreign file reads wrong, the loaded grid is visible for you to correct before
Import, and you can paste the CSV directly. Report the layout and the clustering can be tuned to it.

## Preconditions & limits (read before relying on these)

1. **Custom schedule name needs migration `0234`.** The export title uses the custom name set in Schedule →
   Settings. **Saving** that name requires the `companies.schedule_name` column (migration `0234`). Until it's
   applied: the colour export and all formats work, the title falls back to the **company name**, and trying to
   save a custom name shows a notice that the DB update is pending (it fails **loud**, not silently). Apply with
   `npm run db:apply` from an environment that can reach the database. _(§1.5.3 external-config precondition.)_

2. **One shift per person per day.** The grid — and therefore every export — holds a single shift per person per
   day. If someone works a **split shift** (two non-overlapping shifts the same day, which the double-booking
   rule allows), only the **earliest** is exported and the data-export shows a **notice** telling you how many
   extra shifts weren't included. It is not silent. _(§3.4 honesty.)_

3. **Very large single-image exports.** The colour **PNG** and **canvas** have a ~30k-pixel ceiling; an
   enormous multi-week PNG fails **loud** with a message to export week-by-week. The colour **PDF** avoids this
   by paginating. CSV/Excel/data-PDF have no such ceiling.

4. **Round-trip + foreign-import fidelity is tested.** Export → CSV / Excel / data-PDF → the real import readers
   → the **same shifts** is locked by tests (`scheduleExport.test.ts`, `writeXlsx.test.ts`, `writePdf.test.ts`,
   `pdfIsoGrid.test.ts`), including edge cases: names with commas/quotes, a 13-date schedule (trailing
   single-date page), and a 30-staff (row-paginated) schedule. The **generic foreign-PDF fallback** is verified
   end-to-end through the real `unpdf` extractor (a label-header grid reconstructs to CSV) plus guards for
   **multi-page** PDFs (rows don't collide across pages), coordinate jitter, and multi-word names.

## Where the code lives
- `src/lib/schedule/scheduleExport.ts` — the staff × date grid + CSV.
- `src/lib/schedule/writeXlsx.ts` — dependency-free `.xlsx` (jszip, inline strings).
- `src/lib/schedule/writePdf.ts` — dependency-free PDF (colour image pages + data text table).
- `src/lib/schedule/pdfIsoGrid.ts` — reads an ISO-header PDF back to a grid (`isoGridFromItems`) **and** the
  generic foreign-PDF fallback (`pdfGridToCsv` — column/row clustering, per-page grouping).
- `src/lib/schedule/shiftColors.ts` — the time-of-day colour bands + legend used by the colour export.
- `src/lib/schedule/staffDatePdf.ts` — positioned-text PDF extraction (`extractPdfPages`) + the frendz reader.
- `src/lib/schedule/importTime.ts` — `autoTimeRangeCodeMap` (deterministic explicit-time recognition).
- `src/app/dashboard/schedule/grid/page.tsx` — the Export menu + download handlers.
- `src/app/dashboard/schedule/import/page.tsx` — wires the deterministic mapper into both re-import paths.
