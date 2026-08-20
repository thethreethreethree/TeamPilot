# Build — multi-format re-importable export + landscape

## Features (inventory + A31 reachability — both directions of every seam)

### Re-importable data export (CSV / Excel / data-PDF)
- files: src/lib/schedule/scheduleExport.ts, src/lib/schedule/writeXlsx.ts, src/lib/schedule/writePdf.ts,
  src/lib/schedule/pdfIsoGrid.ts, src/lib/schedule/importTime.ts (autoTimeRangeCodeMap),
  src/lib/schedule/staffDatePdf.ts (import wiring), src/app/dashboard/schedule/grid/page.tsx
- write-path: EXISTS — the manager picks a format in the Grid's Export menu; `buildExportGrid` pivots the derived
  schedule to a staff×date grid, rendered to CSV (`gridToCsv` via shared csvSafe), .xlsx (`buildXlsxBytes`,
  jszip inlineStr), or a data-PDF (`buildTablePdf`, positioned text). The bytes download to the manager's device.
  human_can_set: true.
- read-path: EXISTS — re-importing any of these files runs the existing import pipeline: CSV → parseCsvToGrid;
  .xlsx → xlsxToCsv; PDF → unpdf → `isIsoHeaderGrid`/`isoGridFromItems` (new generic ISO reader, tried before the
  frendz parser) → parseScheduleGrid. `autoTimeRangeCodeMap` maps the explicit-time cells deterministically, so
  re-import needs no manual code mapping. Proven by round-trip tests against the REAL readers. human_can_see: true.

### Colour visual export (PNG + visual PDF) + landscape
- files: src/lib/schedule/writePdf.ts (buildImagePdf), src/app/dashboard/schedule/grid/page.tsx
- write-path: EXISTS — Export → "PNG image" or "PDF (colour)" renders the colour-coded canvas; the PDF embeds it
  as a landscape-A4 page (buildImagePdf, DCTDecode). Print uses `@page { size: landscape }`. human_can_set: true.
- read-path: EXISTS — the downloaded PNG/PDF opens as the colour graphic; Print opens the landscape print dialog.
  This is a human-view artifact (not re-imported — an image). human_can_see: true.

## Files
- `scheduleExport.ts` (NEW) — `buildExportGrid` (derived shifts → staff×date grid, cells "HH:mm-HH:mm"|""),
  `toAoa`, `gridToCsv` (shared csvSafe).
- `writeXlsx.ts` (NEW) — dependency-free .xlsx via jszip, inline-string cells the repo's own reader ingests.
- `writePdf.ts` (NEW) — dependency-free PDF: `buildImagePdf` (landscape image page), `buildTablePdf` (landscape
  positioned-text table, paginates columns×rows).
- `pdfIsoGrid.ts` (NEW) — `isIsoHeaderGrid` + `isoGridFromItems`: read an ISO-header schedule PDF back to a grid.
- `importTime.ts` — `autoTimeRangeCodeMap`: deterministic explicit-"HH:mm-HH:mm"/OFF recognition (round-trip).
- `staffDatePdf.ts` — import IO tries the ISO reader first, else the frendz parser.
- `grid/page.tsx` — Export menu (scope toggle + per-format items), download handlers, landscape print CSS.

## Decisions
- Cells are EXPLICIT "HH:mm-HH:mm" (not org codes), so re-import is deterministic (no LLM) — the round-trip is
  the whole point of the founder's ask.
- The data-PDF uses an ISO-date header + a NEW generic reader rather than mimicking the fragile frendz
  day-number/weekday layout — deterministic and robust; the frendz parser stays the fallback.
- Column/row pagination in the data-PDF mirrors the frendz wrap invariant (merge pages by staff name).
