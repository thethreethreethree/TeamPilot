# VA presence-grid import — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/lib/schedule/vaGrid.ts` | The file-format-INDEPENDENT parser core. `parseTimeBlock` (both notations + ambiguous-shorthand resolution + cross-midnight), `coalesceRanges` (cycle/row-order merge across midnight), `parseVaGrid` (grid → per-staff coalesced shifts + surfaced unparsed blocks). Pure, no dep. | §1.5.1, §3.4 |
| `src/lib/schedule/__tests__/vaGrid.test.ts` | 10 tests: parseTimeBlock (docx + pdf notations, minutes, dashes, malformed), coalesceRanges (touch/gap/across-midnight), and the founder's ACTUAL VA grid (Alex/Kaye/Nikko/Joanne) → asserted coalesced shifts + unparsed surfacing. | A30, §1.5.1 |

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
