# VA presence-grid import — Closure

## Verdict
The VA-parser **core is SHIPPABLE** as an engine: it correctly turns the founder's actual presence grid into
per-staff shifts, including the cross-midnight coalescing that the naive approach gets wrong. It is the
file-format-independent foundation the .docx/.pdf extractors and the pipeline wiring build on.

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
    "item": ".docx and .pdf table EXTRACTION (bytes -> VaGrid) is not built yet.",
    "why_skipped": "The founder chose the full option; the extractor is the next unit. .docx is a zip (word/document.xml table); .pdf is fragile (the shorthand is ambiguous — the .docx is canonical). The parser core is extraction-independent so it is buildable + tested now, ahead of the readers.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "R-VA-3",
    "item": "Recurring weekday template -> concrete dated shifts (target-week resolution) + wiring to planImport/apply_schedule_import + the upload-UI VA path.",
    "why_skipped": "Downstream of extraction. The VA grid is a recurring Mon-Fri pattern with no dates; a target week resolves it to EMPLOYEE_ASSIGNED/SHIFT_DEFINED events via the existing commit path. Its own unit.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
