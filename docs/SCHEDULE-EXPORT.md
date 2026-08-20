# Schedule export & re-import — operator reference

_Last updated 2026-08-20. Covers the Grid → **Export** menu and how exported files re-import._

The schedule Grid (`/dashboard/schedule/grid`) exports the schedule in several formats, with a **This week /
All weeks** scope toggle. Formats split into two groups by purpose.

## Formats

### For viewing / printing (colour graphic — NOT re-importable)
| Format | What it is |
|---|---|
| **PNG image** | The colour-coded schedule graphic (shifts tinted by time of day + legend + custom name). |
| **PDF (colour)** | The same graphic as a landscape PDF. A tall "all weeks" export paginates into multiple landscape pages so it stays readable. |
| **Print** | Opens the browser print dialog with the colour graphic, landscape. |

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

4. **Round-trip fidelity is tested.** Export → CSV / Excel / data-PDF → the real import readers → the **same
   shifts** is locked by tests (`scheduleExport.test.ts`, `writeXlsx.test.ts`, `writePdf.test.ts`,
   `pdfIsoGrid.test.ts`), including edge cases: names with commas/quotes, a 13-date schedule (trailing
   single-date page), and a 30-staff (row-paginated) schedule.

## Where the code lives
- `src/lib/schedule/scheduleExport.ts` — the staff × date grid + CSV.
- `src/lib/schedule/writeXlsx.ts` — dependency-free `.xlsx` (jszip, inline strings).
- `src/lib/schedule/writePdf.ts` — dependency-free PDF (colour image pages + data text table).
- `src/lib/schedule/pdfIsoGrid.ts` — reads an ISO-header PDF back to a grid (data-PDF re-import).
- `src/lib/schedule/importTime.ts` — `autoTimeRangeCodeMap` (deterministic explicit-time recognition).
- `src/app/dashboard/schedule/grid/page.tsx` — the Export menu + download handlers.
- `src/app/dashboard/schedule/import/page.tsx` — wires the deterministic mapper into both re-import paths.
