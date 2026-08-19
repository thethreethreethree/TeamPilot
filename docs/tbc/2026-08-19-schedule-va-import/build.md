# VA presence-grid import — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/lib/schedule/vaGrid.ts` | The file-format-INDEPENDENT parser core. `parseTimeBlock` (both notations + ambiguous-shorthand resolution + cross-midnight), `coalesceRanges` (cycle/row-order merge across midnight), `parseVaGrid` (grid → per-staff coalesced shifts + surfaced unparsed blocks). Pure, no dep. | §1.5.1, §3.4 |
| `src/lib/schedule/__tests__/vaGrid.test.ts` | 10 tests: parseTimeBlock (docx + pdf notations, minutes, dashes, malformed), coalesceRanges (touch/gap/across-midnight), and the founder's ACTUAL VA grid (Alex/Kaye/Nikko/Joanne) → asserted coalesced shifts + unparsed surfacing. | A30, §1.5.1 |
| `src/lib/schedule/vaDocx.ts` | **R-VA-2 (.docx extraction).** `parseDocxTableCells` (word/document.xml table → 2D cell grid, pure), `cellGridToVaGrid` (→ VaGrid: header→staff, "On Duty"→presence), `extractVaGridFromDocx` (jszip IO wrapper, reuses the bomb-guarded `unzipEntry`). The .docx is canonical (explicit meridiems). | §1.5.1, §3.4 |
| `src/lib/schedule/__tests__/vaDocx.test.ts` | 4 tests: table extraction ignoring outside-table paragraphs, split-run "On Duty", blank cells, and .docx→VaGrid→shifts end-to-end. VERIFIED against the founder's REAL VA_Weekly_Schedule.docx (header + all 12 rows extracted exactly). | A30, §1.5.1 |
| `src/lib/documents/extractText.ts` | Exported `unzipEntry` (reuse over duplication — the docx extractor shares the one bomb-guarded zip-entry read). | §6 |
| `src/lib/schedule/vaPdf.ts` + test | **R-VA-2 (.pdf).** plain text collapses columns; `pdfItemsToVaGrid` recovers WHO-is-on-duty from unpdf's POSITIONED items (extractTextItems x,y) by matching each mark's x to the nearest staff-header x. `extractVaGridFromPdf` is the IO wrapper. Tested with the REAL file's coordinates; converges on the same shifts as the docx. | §1.5.1, §3.4, §2 |
| `src/lib/schedule/vaResolve.ts` + test | **R-VA-3 core.** `resolveVaToPreview` turns the recurring Mon–Fri template into a dated `ImportPreview` for a target week — the SAME structure the CSV import produces, so VA converges on the existing `planImport → apply_schedule_import` commit path (no parallel writer). `addDaysIso` UTC-deterministic. End-to-end test: grid → parse → resolve → planImport. | §1.5.1 (layer 3), §6 |
| `src/lib/schedule/vaImport.ts` + test | **R-VA-3 route glue.** `extractAndResolveVa(bytes, filename, opts)` — ONE bytes→dated-preview path (format allowlist docx/pdf → extract → parse → resolve) both routes call, so the commit re-runs it deterministically rather than trusting a client plan. Allowlist unit-tested. | A33, §6 |
| `src/app/api/schedule/upload/va/preview/route.ts` + `commit/route.ts` + test | **R-VA-3 routes.** POST a .docx/.pdf (base64) + target week → preview / atomic commit. Auth-FIRST + manager-only, base64 size cap, format allowlist + bomb guard, maxDuration, CWE-209 typed→safe errors (415/422/413/500). Commit re-extracts deterministically, refuses on unparsed blocks, applies via apply_schedule_import. 6 route tests. | §1.5.1 (layer 2), §3.4, A30 |
| `src/app/dashboard/schedule/import/page.tsx` | **R-VA-3 UI (layer 4).** Added a "Schedule file (.docx/.pdf)" mode beside CSV: file picker + target-week date + Preview→Import wired to /upload/va/{preview,commit}. FileReader base64 (avoids the fromCharCode stack overflow); shell-scroll idiom preserved; design tokens (bg-base/glass-card/text-*); typecheck + theme:audit clean. **Visual render is the founder's remaining check (the gate can't render React).** | §1.5.1 (layer 4) |

## Features (reachability inventory)

### VA presence-grid parse (core)
Turn a time-block×staff On-Duty grid into per-staff shifts (recurring weekday template).
- write-path: the parser is PURE (no IO); its consumer is the .docx/.pdf extractor → the import commit path
  (planImport → apply_schedule_import). That wiring is the NEXT unit (residual R-VA-2/3). human_can_set: not yet
  (the upload UI VA path is a later unit) — this unit is the tested engine the surfaces will call.
- read-path: `parseVaGrid` returns `{ shiftsByStaff, unparsedBlocks }`; the extractor/commit unit consumes it.

## Step 7 — Reachability (A31)
This unit is the parse ENGINE, not yet a wired user surface — deliberately (the hard, format-independent logic
built + locked first). It is reachable + proven now via the test that runs the founder's real grid. The extractor
(.docx/.pdf → VaGrid), the recurring→dated resolution, and the upload-UI VA path are the remaining units that make
it human-reachable; each is a residual below.
