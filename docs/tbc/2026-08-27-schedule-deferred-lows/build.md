# BUILD — schedule deferred LOW fixes

### Upload cap (§1.5.1 layer 2)
- write-path: `uploadLimits.ts` (new) — `MAX_UPLOAD_BYTES` (3 MB) + `MAX_UPLOAD_BASE64_CHARS` (4.2 M) + `oversizeMessage`.
  `import/page.tsx` pre-flights each binary upload (`extractGridFile`, `vaRunPreview`, `vaCommit`) against the raw file
  size. `vaUpload.ts` + `grid-pdf/extract/route.ts` cap the base64 body at `MAX_UPLOAD_BASE64_CHARS` (was a lying 6 MB).
- read-path: a manager uploading a too-big file sees "That file is X MB — the upload limit is 3 MB…", not an opaque 413.

### Printed unassigned-shift warning (§3.4)
- write-path: `grid/page.tsx` — `weekGridData` now exposes `emptyShifts`; `renderCanvas` draws a footer
  "⚠ N shift(s) have no one assigned" when any week has an unassigned shift.
- read-path: the printed/PNG colour schedule tells the manager about a gap instead of looking fully staffed.

### PDF non-Latin names (§3.4)
- write-path: `writePdf.ts` `pdfText` — NFKD + strip combining marks (José→Jose) then map non-Latin-1 → '?', then escape.
- read-path: the re-importable table PDF shows a readable/round-trippable name or a visible placeholder, never mojibake.

### xlsx column amplification (robustness)
- write-path: `staffDateXlsx.ts` — `MAX_XLSX_COLS` (256) bounds the sparse back-fill; a cell past it is dropped.
- read-path: a crafted far-right cell ref can't inflate each row to 16k elements.

### Rate-limit replay GETs
- write-path: `events/route.ts` GET + `coverage/route.ts` GET each add a 60/min `rateLimit` (matching their POSTs).
- read-path: a burst can't hammer the full-log replay.

## Files
- `src/lib/schedule/uploadLimits.ts` (new, + test) · `import/page.tsx` · `vaUpload.ts` · `grid-pdf/extract/route.ts` — upload cap
- `src/app/dashboard/schedule/grid/page.tsx` — printed warning
- `src/lib/schedule/writePdf.ts` (+ test) — PDF names
- `src/lib/schedule/staffDateXlsx.ts` (+ test) — xlsx cap
- `src/app/api/schedule/events/route.ts` · `coverage/route.ts` — GET rate-limits

## Ripple (§6 item 5)
`weekGridData` gained an `emptyShifts` field (one consumer). `pdfText` is now exported for the test. The upload limit
is single-sourced in `uploadLimits.ts` — client + server import the same constants, so the advertised limit and the
server cap can't drift. No schema/RPC/migration change; the CSV export + re-import round-trip are untouched.

## Honest limit
The printed-warning footer and the GET rate-limits have no pure unit seam (canvas rendering; a one-line limiter that
mirrors 27 sibling routes) — locked by reasoning + the full gate, not a dedicated test. The pure seams (upload limit,
pdfText, xlsx cap) each carry a failing-without-it test.
