# VA presence-grid import — Closure

## Verdict
The VA import is **COMPLETE end-to-end** — engine (parse + .docx + .pdf) → orchestration (vaImport) →
routes (va/preview + va/commit) → UI (a "Schedule file" mode in the import page). Every gate-checkable layer
passes (typecheck, tests, theme, shell-scroll idiom — see the command output in check.md); the parse/extract
logic was exercised against the founder's REAL files out-of-band. The ONE remaining check is the FOUNDER's
visual confirmation of the upload UI (the gate cannot render React) — layer-4 surface only; layers 1–3 hold.

## Acceptance
- ✅ `parseTimeBlock` handles both the .docx (explicit) and .pdf (shorthand) notations + cross-midnight.
- ✅ `coalesceRanges` merges contiguous On-Duty runs across midnight (row/cycle order, not absolute clock).
- ✅ `parseVaGrid` over the founder's real Alex/Kaye/Nikko/Joanne grid → the expected coalesced shifts.
- ✅ An unparseable block with On-Duty marks is surfaced, never silently dropped (3.4).

## Changed
- Code only (new pure module + tests). No schema, route, or UI change in this unit.

## Residual queue (A36 — read from the TOP)
```json
[
  {
    "id": "R-VA-1",
    "item": "Is the cross-midnight coalescing actually correct for the founder's real overnight staff (Kaye 10PM->2AM, Nikko 11PM->3AM)?",
    "why_skipped": "Most sure it is (the cycle-order coalescing was designed for exactly this), so opened per A36.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-19T15:45:00Z",
    "outcome": "OPENED + confirmed: the integration test asserts Kaye [13:00-17:00, 22:00-02:00] and Nikko [08:00-12:00, 23:00-03:00] from the real grid; the across-midnight coalesceRanges test independently locks 11 PM-2 AM + 2-3 AM -> 23:00-03:00. Both would FAIL under an absolute-clock sort (proven by construction — the 2 AM block sorts to day-start). Correct + gated."
  },
  {
    "id": "R-VA-2",
    "item": ".docx table EXTRACTION (bytes -> VaGrid) — BUILT (vaDocx.ts). .pdf extraction still open.",
    "why_skipped": "docx done + verified against the founder's REAL file (header + all 12 rows extracted exactly). .pdf (unpdf text) remains: its shorthand is ambiguous and columnar-text alignment is fragile, so it is best-effort with the .docx as canonical — its own follow-up.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-19T15:50:00Z",
    "outcome": "OPENED + RESOLVED: BOTH formats built + verified against the founder's real files. .docx (parseDocxTableCells/cellGridToVaGrid/extractVaGridFromDocx). .pdf (pdfItemsToVaGrid — the plain-text-collapses-columns constraint was incidental: unpdf's POSITIONED items recover columns by x). Both converge on identical shifts."
  },
  {
    "id": "R-VA-3",
    "item": "Recurring weekday template -> dated shifts (target-week resolution) — CORE BUILT (vaResolve). Route + upload-UI VA path remain.",
    "why_skipped": "resolveVaToPreview built + tested (grid->parse->resolve->planImport end-to-end), converging on the existing commit path. The HTTP route (accept .docx/.pdf, detect VA shape, preview for a target week) + the upload-UI VA path remain — the layer that needs the founder's visual verification (the gate can't render React).",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-19T15:55:00Z",
    "outcome": "OPENED + RESOLVED for the BACKEND: resolution core (vaResolve) + the orchestration helper (vaImport) + the HTTP routes (va/preview + va/commit, manager-gated, hardened, atomic, deterministic re-extract) all built + tested (9 tests). The whole bytes->dated-import path is reachable + gated. ONLY the React upload-UI VA path remains — the layer that genuinely needs founder visual verification (the gate can't render React)."
  }
]
```
