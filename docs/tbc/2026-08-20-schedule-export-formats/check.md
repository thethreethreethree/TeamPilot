# Check — the canonical command + round-trip proofs

## Findings
No findings. The load-bearing risk was the ROUND-TRIP (does an exported file actually re-import?), so the
verification runs each format through the REAL import readers, not a mock.

## Canonical verification command (A38)
```
npm run check
```
= typecheck && lint && theme:audit && rls:audit && invariant:audit && test (+ tbc stages). Exit 0 is the bar.
`npx tsc --noEmit` → 0.

## Round-trip proofs (against the real readers, not mocks)
- **CSV** — `scheduleExport.test.ts`: buildExportGrid → gridToCsv → parseCsvToGrid → parseScheduleGrid (with
  autoTimeRangeCodeMap) → the exact exported shifts; `unknownCodes` empty (every cell recognized, no manual map).
- **Excel** — `writeXlsx.test.ts`: buildSheetXml → the repo's `xlsxSheetToCells` round-trips the grid exactly;
  and a full `buildXlsxBytes` → `xlsxToCsv` (the real unzip+parse reader) → parsers → same shifts.
- **Data PDF** — `writePdf.test.ts`: buildTablePdf → the REAL `unpdf` extractTextItems → `isoGridFromItems` →
  parsers → same shifts. `isIsoHeaderGrid` correctly detects the ISO header.
- **Visual PDF** — structural: valid %PDF-1.4, `/Filter /DCTDecode`, landscape `/MediaBox [0 0 842 595]`, `%%EOF`.
- **Auto-mapping honesty** — explicit "HH:mm-HH:mm" + OFF map; ambiguous "6-3"/"GY" are left unmapped (no guess).

## Not verified here (honest)
- The Export MENU pixels in the live app (data + auth needed) — the menu is plain Tailwind over verified
  handlers; the download handlers are exercised by the round-trip tests at the library level.
- The visual PDF rendered by a PDF viewer — asserted structurally (valid PDF), not opened in a viewer here.
